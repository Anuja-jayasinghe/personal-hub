import { randomBytes } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { appConfig } from "@/config/app.config";
import type { Db } from "@/db/read";
import { accessGrants, appSettings, people, pushSubscriptions } from "@/db/schema";
import { NotSentError } from "@/features/notifications/channels";
import type { ActionState } from "@/features/shared/types";
import { ValidationError } from "@/features/shared/validation";
import { isAllowedEmail } from "@/lib/allowed-emails";
import { todayIn } from "@/lib/dates";
import { safeErrorSummary } from "@/lib/errors";
import { accessFromGrants, type Area, type Level } from "./access";
import { cleanGrants, summariseAccess } from "./access-summary";
import { INVITATION_LIMITS, invitationExpiry, resendAvailability, resendRefusal } from "./invitation-config";
import { buildInvitationEmail, invitationIdempotencyKey, type InvitationMessage } from "./invitation-email";
import { parsePersonEmail, parsePersonName } from "./validate";

/**
 * The invitation system's logic (issue #236, DECISIONS C154), as plain functions with their dependencies
 * passed in: no "use server", no `requireUser`, no `refresh()`. The Server Actions (invitation-actions.ts)
 * check that the caller is an owner and then call these; a script can run the very same code with the real
 * database and the real sender. That also means NOTHING here checks who is calling: never import this
 * from a page or a route.
 *
 * The flow, for one invitation:
 *  1. In ONE transaction: validate, claim one of the owner's daily sends, and write the person as
 *     `invited` (a placeholder with the chosen grants, an unguessable code, a 14 day expiry). A person
 *     who is `pending`, `expired` or already `invited` (and past the 24 hour rule) is refreshed, never
 *     duplicated; `active` and `blocked` are refused.
 *  2. THEN send the email. The row is kept whatever happens: a refused send (nothing went out) says so
 *     and can be repeated with Resend; an unknown outcome (timeout, 5xx) is never claimed as sent and
 *     never retried automatically. Outside the live site nothing is sent at all (a dry run).
 */

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type InvitationDeps = {
  db: Db;
  now: Date;
  /** The site address the link points at (appConfig.siteUrl in the app). */
  siteUrl: string;
  /** The owner who is inviting: their address is recorded as invited_by and never shown or emailed. */
  inviter: { email: string; firstName: string | null };
  /** The owners' addresses (ALLOWED_EMAILS): an owner cannot be invited. */
  ownerEmails: readonly string[];
  /** The production-only gate, decided by the caller. False: the invitation is saved and nothing is sent. */
  live: boolean;
  /** Sends one email. Throws `NotSentError` when nothing went out, anything else when unsure. */
  sendEmail: (message: InvitationMessage) => Promise<void>;
  /** For tests: the invitation code. */
  newCode?: () => string;
};

export type InvitationResult = "sent" | "dry-run" | "refused" | "unknown";
export type InvitationOutcome = { personId: string; result: InvitationResult; expiresAt: Date; detail?: string };

/** 128 random bits as 22 URL-safe characters. */
export const newInviteCode = () => randomBytes(16).toString("base64url");
export const inviteLink = (siteUrl: string, code: string) => `${siteUrl.replace(/\/+$/, "")}/sign-up?invite=${code}`;

/**
 * Claims one of the owner's invitations for today (counted per owner and calendar day in the app time
 * zone, one app_settings row). Atomic: the count only goes up while it is under the limit. It runs inside
 * the invitation's transaction, so a refused invitation does not use one up.
 */
async function claimDailyInvitation(tx: Tx, ownerEmail: string, now: Date): Promise<void> {
  const key = `invite-quota:${ownerEmail.trim().toLowerCase()}:${todayIn(appConfig.timeZone, now)}`;
  const limit = INVITATION_LIMITS.maxPerOwnerPerDay;
  const claimed = await tx
    .insert(appSettings)
    .values({ key, value: { count: 1 }, updatedAt: now })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: sql`jsonb_build_object('count', ((${appSettings.value}->>'count')::int + 1))`, updatedAt: now },
      setWhere: sql`((${appSettings.value}->>'count')::int) < ${limit}`,
    })
    .returning({ key: appSettings.key });
  if (claimed.length === 0) throw new ValidationError(`You have used today's ${limit} invitations and resends. Try again tomorrow.`);
}

/** What the owner is told. Never claims an unknown outcome as sent. */
export function outcomeState(outcome: InvitationOutcome): ActionState {
  switch (outcome.result) {
    case "sent":
      return { ok: true, id: outcome.personId, notice: "Invitation sent. It is in the list below." };
    case "dry-run":
      return { ok: true, id: outcome.personId, notice: "Saved. The email is only sent from the live site." };
    case "refused":
      return {
        ok: false,
        id: outcome.personId,
        error: `Saved, but the email was not sent${outcome.detail ? ` (${outcome.detail})` : ""}. Nothing went out. You can send it again from the list.`,
      };
    case "unknown":
      return {
        ok: true,
        id: outcome.personId,
        notice: "Saved, but the email service did not answer clearly, so the email may or may not have gone out. Ask them before sending it again.",
      };
  }
}

/** Sends the email for a freshly written invitation, then settles the row (see the flow above). */
async function deliver(
  deps: InvitationDeps,
  sent: { personId: string; email: string; code: string; expiresAt: Date; sendCount: number; previousSentAt: Date | null; grants: Partial<Record<Area, Level>> },
): Promise<InvitationOutcome> {
  const base = { personId: sent.personId, expiresAt: sent.expiresAt };
  // Nothing went out: put the "last sent" stamp back, so the owner is not made to wait out a cooldown for an email that never left.
  const unsend = () =>
    deps.db
      .update(people)
      .set({ inviteSentAt: sent.previousSentAt })
      .where(and(eq(people.id, sent.personId), eq(people.inviteSendCount, sent.sendCount)));

  if (!deps.live) {
    await unsend();
    return { ...base, result: "dry-run" };
  }
  const message: InvitationMessage = {
    ...buildInvitationEmail({
      inviterFirstName: deps.inviter.firstName,
      accessLines: summariseAccess(sent.grants),
      link: inviteLink(deps.siteUrl, sent.code),
      expiresAt: sent.expiresAt,
    }),
    to: sent.email,
    idempotencyKey: invitationIdempotencyKey(sent.personId, sent.sendCount),
  };
  try {
    await deps.sendEmail(message);
    return { ...base, result: "sent" };
  } catch (err) {
    // The error's name and status only: it must never carry the address or the body.
    console.error(`Invitation email ${err instanceof NotSentError ? "was refused" : "has an unknown outcome"}: ${safeErrorSummary(err)}`);
    if (err instanceof NotSentError) {
      await unsend().catch(() => undefined);
      return { ...base, result: "refused", detail: err.message.replace(/\S+@\S+/g, "[address]").slice(0, 120) };
    }
    return { ...base, result: "unknown" };
  }
}

type Existing = typeof people.$inferSelect;

/** Writes the invitation columns for a person. */
function invitationColumns(deps: InvitationDeps, existing: Pick<Existing, "inviteSendCount" | "inviteSentAt"> | null, code: string) {
  return {
    status: "invited" as const,
    invitedBy: deps.inviter.email.trim().toLowerCase(),
    inviterName: deps.inviter.firstName,
    inviteCode: code,
    inviteExpiresAt: invitationExpiry(deps.now),
    inviteSentAt: deps.now,
    inviteOpenedAt: null,
    inviteSendCount: (existing?.inviteSendCount ?? 0) + 1,
  };
}

/**
 * Invites an address: creates (or refreshes) the placeholder person and sends the email.
 * Throws `ValidationError` (a message safe to show) for anything the owner must fix.
 */
export async function createInvitation(deps: InvitationDeps, input: { email: string; name?: string | null; grants: Record<string, unknown> }): Promise<InvitationOutcome> {
  const parsed = parsePersonEmail(input.email);
  if (!parsed.ok) throw new ValidationError(parsed.error);
  if (isAllowedEmail(parsed.email, [...deps.ownerEmails])) throw new ValidationError("That address is an owner already.");
  const name = parsePersonName(input.name);
  const grants = cleanGrants(input.grants);
  if (Object.keys(grants).length === 0) throw new ValidationError("Choose at least one section they can see.");
  const code = (deps.newCode ?? newInviteCode)();

  const written = await deps.db.transaction(async (tx) => {
    const [existing] = await tx.select().from(people).where(eq(people.email, parsed.email)).for("update");
    if (existing?.status === "active") throw new ValidationError("That person already has access. Change what they see in the list below.");
    if (existing?.status === "blocked") throw new ValidationError("That person is blocked. Let them back in first (under Blocked below), then invite them.");
    if (existing?.status === "invited" && existing.inviteSentAt && deps.now.getTime() - existing.inviteSentAt.getTime() < INVITATION_LIMITS.sameAddressMs) {
      throw new ValidationError("That address was invited less than a day ago. Use Resend in the list if they did not get it.");
    }
    if (existing && existing.inviteSendCount >= INVITATION_LIMITS.maxSendsPerPerson) {
      throw new ValidationError(`That address has been sent ${INVITATION_LIMITS.maxSendsPerPerson} invitations already. Withdraw it in the list, then invite again.`);
    }
    await claimDailyInvitation(tx, deps.inviter.email, deps.now);

    const columns = invitationColumns(deps, existing ?? null, code);
    let personId: string;
    if (existing) {
      const [row] = await tx
        .update(people)
        .set({ ...columns, ...(name ? { name } : {}) })
        .where(and(eq(people.id, existing.id), eq(people.status, existing.status)))
        .returning({ id: people.id });
      if (!row) throw new ValidationError("That person just changed. Reload the page and try again.");
      personId = row.id;
    } else {
      // A second invitation for the same new address at the same instant: the unique email decides, the loser is told.
      const [row] = await tx.insert(people).values({ email: parsed.email, name, ...columns }).onConflictDoNothing().returning({ id: people.id });
      if (!row) throw new ValidationError("That address was just added. Reload the page and try again.");
      personId = row.id;
    }
    await tx.delete(accessGrants).where(eq(accessGrants.personId, personId));
    await tx.insert(accessGrants).values(Object.entries(grants).map(([area, level]) => ({ personId, area, level: level as Level })));
    return { personId, sendCount: columns.inviteSendCount, previousSentAt: existing?.inviteSentAt ?? null, expiresAt: columns.inviteExpiresAt };
  });

  return deliver(deps, { ...written, email: parsed.email, code, grants });
}

/**
 * Sends a waiting invitation again: a new code and a new expiry, status back to `invited`. Only for
 * `invited` and `expired` people; at most once an hour per person, 5 sends in all, and it counts towards
 * the owner's daily limit.
 */
export async function resendInvitationCore(deps: InvitationDeps, personId: string): Promise<InvitationOutcome> {
  const code = (deps.newCode ?? newInviteCode)();
  const written = await deps.db.transaction(async (tx) => {
    const [existing] = await tx.select().from(people).where(eq(people.id, personId)).for("update");
    if (!existing) throw new ValidationError("That person is not in the list any more.");
    const state = resendAvailability(existing, deps.now);
    if (!state.ok) throw new ValidationError(resendRefusal(state, deps.now));
    await claimDailyInvitation(tx, deps.inviter.email, deps.now);

    const columns = invitationColumns(deps, existing, code);
    const [row] = await tx
      .update(people)
      .set(columns)
      .where(and(eq(people.id, existing.id), inArray(people.status, ["invited", "expired"])))
      .returning({ id: people.id });
    if (!row) throw new ValidationError("That person just changed. Reload the page and try again.");
    const grantRows = await tx.select({ area: accessGrants.area, level: accessGrants.level }).from(accessGrants).where(eq(accessGrants.personId, existing.id));
    const access = accessFromGrants(grantRows);
    return {
      personId: existing.id,
      email: existing.email,
      grants: access.owner ? {} : access.grants,
      sendCount: columns.inviteSendCount,
      previousSentAt: existing.inviteSentAt,
      expiresAt: columns.inviteExpiresAt,
    };
  });
  return deliver(deps, { ...written, code });
}

/**
 * Withdraws an invitation: deletes the placeholder (its grants go with it) and any push devices keyed by
 * its address (none are expected). Only `invited` and `expired` rows: a person who has joined is never
 * touched here (use `removePerson`). Returns false when there was nothing to withdraw.
 */
export async function withdrawInvitationCore(deps: { db: Db }, personId: string): Promise<boolean> {
  return deps.db.transaction(async (tx) => {
    const [gone] = await tx.delete(people).where(and(eq(people.id, personId), inArray(people.status, ["invited", "expired"]))).returning({ email: people.email });
    if (gone) {
      await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.recipient, gone.email));
      return true;
    }
    const [still] = await tx.select({ status: people.status }).from(people).where(eq(people.id, personId));
    if (still) throw new ValidationError("That person has already joined. Use Remove in their card if you want to take their access away.");
    return false;
  });
}
