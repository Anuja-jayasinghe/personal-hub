import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/read";
import { accessGrants, appSettings, people, pushSubscriptions } from "@/db/schema";
import { NotSentError } from "@/features/notifications/channels";
import { ValidationError } from "@/features/shared/validation";
import { makeTestDb } from "@/test/pglite";
import { INVITATION_LIMITS } from "./invitation-config";
import type { InvitationMessage } from "./invitation-email";
import { createInvitation, inviteLink, newInviteCode, outcomeState, resendInvitationCore, withdrawInvitationCore, type InvitationDeps } from "./invitations";

/**
 * The invitation logic (issue #236, DECISIONS C154) against an in-memory Postgres, with a fake sender:
 * nothing is ever sent, nothing real is touched. Made-up addresses only.
 */
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const T0 = new Date("2026-11-24T04:00:00Z");
const OWNER = "owner@example.com";
const SOMEONE = "someone@example.com";
const P256DH = `B${"A".repeat(86)}`;
const AUTH = "abcdefghijklmnopqrstuv";
const GRANTS = { vehicles: "add", bills: "see" };

let db: Db;
let counter = 0;
const sent: InvitationMessage[] = [];
const sendEmail = vi.fn(async (message: InvitationMessage) => {
  sent.push(message);
});

const deps = (over: Partial<InvitationDeps> = {}): InvitationDeps => ({
  db,
  now: T0,
  siteUrl: "https://hub.example.test",
  inviter: { email: "Owner@Example.com", firstName: "Asha" },
  ownerEmails: [OWNER],
  live: true,
  sendEmail,
  newCode: () => `code${String(++counter).padStart(18, "0")}`,
  ...over,
});
const person = async (email: string) => (await db.select().from(people).where(eq(people.email, email)))[0];
const grantsOf = async (id: string) => Object.fromEntries((await db.select().from(accessGrants).where(eq(accessGrants.personId, id))).map((g) => [g.area, g.level]));
const quota = async () => (await db.select().from(appSettings).where(sql`${appSettings.key} like 'invite-quota:%'`)).map((r) => r.value);

beforeEach(async () => {
  if (!db) db = (await makeTestDb()).db;
  await db.delete(people);
  await db.delete(appSettings);
  await db.delete(pushSubscriptions);
  vi.restoreAllMocks();
  sent.length = 0;
  sendEmail.mockReset();
  sendEmail.mockImplementation(async (message) => {
    sent.push(message);
  });
  counter = 0;
}, 60_000);

describe("createInvitation", () => {
  it("writes an invited placeholder with the chosen access, then sends one email", async () => {
    const outcome = await createInvitation(deps(), { email: " Someone@Example.com ", name: "  Some   One ", grants: GRANTS });
    expect(outcome.result).toBe("sent");
    const row = await person(SOMEONE);
    expect(row).toMatchObject({
      status: "invited",
      name: "Some One",
      invitedBy: OWNER, // lower-cased
      inviterName: "Asha",
      inviteSendCount: 1,
      inviteOpenedAt: null,
    });
    expect(row.inviteSentAt?.getTime()).toBe(T0.getTime());
    expect(row.inviteExpiresAt?.getTime()).toBe(T0.getTime() + 14 * DAY);
    expect(row.inviteCode).toMatch(/^code/);
    expect(await grantsOf(row.id)).toEqual(GRANTS);
    expect(outcome.personId).toBe(row.id);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [message] = sent;
    expect(message.to).toBe(SOMEONE);
    expect(message.text).toContain(`https://hub.example.test/sign-up?invite=${row.inviteCode}`);
    expect(message.subject).toBe("Asha invited you to hub");
    expect(message.idempotencyKey).toMatch(/^hub-invite\/[0-9a-f]{32}$/);
    expect(JSON.stringify(message)).not.toContain(OWNER);
  });

  it("refuses an owner's address (any case) and writes nothing", async () => {
    await expect(createInvitation(deps(), { email: "OWNER@example.com", grants: GRANTS })).rejects.toThrow("That address is an owner already.");
    expect(await db.select().from(people)).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await quota()).toEqual([]);
  });

  it("refuses a bad address and an empty choice of access", async () => {
    await expect(createInvitation(deps(), { email: "nope", grants: GRANTS })).rejects.toBeInstanceOf(ValidationError);
    await expect(createInvitation(deps(), { email: SOMEONE, grants: {} })).rejects.toThrow("Choose at least one section");
    await expect(createInvitation(deps(), { email: SOMEONE, grants: { vehicles: "hidden", nonsense: "edit", bills: "root" } })).rejects.toThrow("Choose at least one section");
    expect(await db.select().from(people)).toHaveLength(0);
  });

  it("refuses an active person and a blocked person, changes nothing, and uses no daily send", async () => {
    await db.insert(people).values([
      { email: "active@example.com", status: "active", name: "Active" },
      { email: "blocked@example.com", status: "blocked" },
    ]);
    await expect(createInvitation(deps(), { email: "active@example.com", grants: GRANTS })).rejects.toThrow("already has access");
    await expect(createInvitation(deps(), { email: "blocked@example.com", grants: GRANTS })).rejects.toThrow("blocked");
    expect((await person("active@example.com")).status).toBe("active");
    expect((await person("active@example.com")).inviteCode).toBeNull();
    expect((await person("blocked@example.com")).status).toBe("blocked");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await quota()).toEqual([]);
  });

  it("upgrades a pending person instead of duplicating them, replacing their grants", async () => {
    const [pending] = await db.insert(people).values({ email: SOMEONE, status: "pending", createdAt: new Date("2026-11-01T00:00:00Z") }).returning();
    await db.insert(accessGrants).values({ personId: pending.id, area: "tasks_notes", level: "edit" });
    await createInvitation(deps(), { email: SOMEONE, grants: GRANTS });
    const rows = await db.select().from(people);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: pending.id, status: "invited" });
    expect(rows[0].createdAt.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(await grantsOf(pending.id)).toEqual(GRANTS);
  });

  it("refreshes an expired invitation with a new code and expiry, counting the send", async () => {
    await createInvitation(deps(), { email: SOMEONE, grants: GRANTS });
    const first = await person(SOMEONE);
    await db.update(people).set({ status: "expired" }).where(eq(people.id, first.id));
    const later = new Date(T0.getTime() + 20 * DAY);
    await createInvitation(deps({ now: later }), { email: SOMEONE, grants: { vehicles: "edit" } });
    const rows = await db.select().from(people);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: first.id, status: "invited", inviteSendCount: 2 });
    expect(rows[0].inviteCode).not.toBe(first.inviteCode);
    expect(rows[0].inviteExpiresAt?.getTime()).toBe(later.getTime() + 14 * DAY);
    expect(await grantsOf(first.id)).toEqual({ vehicles: "edit" });
  });

  it("does not invite the same address twice within 24 hours, then lets a refresh through", async () => {
    await createInvitation(deps(), { email: SOMEONE, grants: GRANTS });
    await expect(createInvitation(deps({ now: new Date(T0.getTime() + 23 * HOUR) }), { email: SOMEONE, grants: GRANTS })).rejects.toThrow("less than a day ago");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect((await person(SOMEONE)).inviteSendCount).toBe(1);
    await createInvitation(deps({ now: new Date(T0.getTime() + 25 * HOUR) }), { email: SOMEONE, grants: GRANTS });
    expect((await person(SOMEONE)).inviteSendCount).toBe(2);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("stops after 5 sends to one person", async () => {
    await createInvitation(deps(), { email: SOMEONE, grants: GRANTS });
    await db.update(people).set({ inviteSendCount: INVITATION_LIMITS.maxSendsPerPerson, status: "expired" }).where(eq(people.email, SOMEONE));
    await expect(createInvitation(deps({ now: new Date(T0.getTime() + 30 * DAY) }), { email: SOMEONE, grants: GRANTS })).rejects.toThrow("5 invitations already");
  });

  it("allows 10 invitations a day per owner and refuses the 11th; the next day starts again", async () => {
    for (let i = 0; i < INVITATION_LIMITS.maxPerOwnerPerDay; i++) await createInvitation(deps(), { email: `p${i}@example.com`, grants: GRANTS });
    await expect(createInvitation(deps(), { email: "p10@example.com", grants: GRANTS })).rejects.toThrow("today's 10 invitations");
    expect(await person("p10@example.com")).toBeUndefined();
    expect(sendEmail).toHaveBeenCalledTimes(10);
    // Another owner is counted on their own.
    await createInvitation(deps({ inviter: { email: "second@example.com", firstName: null } }), { email: "p11@example.com", grants: GRANTS });
    // A new calendar day (Colombo time) starts again.
    await createInvitation(deps({ now: new Date(T0.getTime() + DAY) }), { email: "p12@example.com", grants: GRANTS });
    expect(await person("p12@example.com")).toBeDefined();
  });

  it("a send that is refused keeps the row, says nothing went out, and lets the owner resend at once", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    sendEmail.mockImplementation(async () => {
      throw new NotSentError(`Resend refused it (422, validation_error) for ${SOMEONE}`);
    });
    const outcome = await createInvitation(deps(), { email: SOMEONE, grants: GRANTS });
    expect(outcome.result).toBe("refused");
    expect(outcome.detail).not.toContain(SOMEONE);
    const row = await person(SOMEONE);
    expect(row).toMatchObject({ status: "invited", inviteSendCount: 1, inviteSentAt: null });
    expect(await grantsOf(row.id)).toEqual(GRANTS);
    const state = outcomeState(outcome);
    expect(state.ok).toBe(false);
    expect(state.error).toContain("not sent");
    expect(log.mock.calls.flat().join(" ")).not.toContain(SOMEONE);
    // Not made to wait out a cooldown for an email that never left.
    sendEmail.mockImplementation(async (m) => void sent.push(m));
    expect((await resendInvitationCore(deps(), row.id)).result).toBe("sent");
  });

  it("an unknown outcome is never claimed as sent and is not retried", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    sendEmail.mockImplementation(async () => {
      throw new Error("Resend did not answer within 10 s");
    });
    const outcome = await createInvitation(deps(), { email: SOMEONE, grants: GRANTS });
    expect(outcome.result).toBe("unknown");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const row = await person(SOMEONE);
    expect(row.inviteSentAt?.getTime()).toBe(T0.getTime()); // it may have gone out: the cooldown applies
    const state = outcomeState(outcome);
    expect(state.ok).toBe(true);
    expect(state.notice).toMatch(/may or may not/);
    expect(state.notice).not.toMatch(/invitation sent/i);
  });

  it("outside the live site it saves the invitation and sends nothing (a dry run)", async () => {
    const outcome = await createInvitation(deps({ live: false }), { email: SOMEONE, grants: GRANTS });
    expect(outcome.result).toBe("dry-run");
    expect(sendEmail).not.toHaveBeenCalled();
    const row = await person(SOMEONE);
    expect(row).toMatchObject({ status: "invited", inviteSentAt: null });
    expect(outcomeState(outcome).notice).toBe("Saved. The email is only sent from the live site.");
  });

  it("two invitations for the same new address at the same moment leave one row and one email", async () => {
    const results = await Promise.allSettled([createInvitation(deps(), { email: SOMEONE, grants: GRANTS }), createInvitation(deps(), { email: SOMEONE, grants: GRANTS })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(await db.select().from(people)).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("the codes it makes are long, URL-safe and different", () => {
    const codes = new Set(Array.from({ length: 50 }, newInviteCode));
    expect(codes.size).toBe(50);
    for (const c of codes) expect(c).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(inviteLink("https://hub.example.test/", "abc")).toBe("https://hub.example.test/sign-up?invite=abc");
  });
});

describe("resendInvitationCore", () => {
  const invite = async () => {
    await createInvitation(deps(), { email: SOMEONE, grants: GRANTS });
    return person(SOMEONE);
  };

  it("works for invited and expired only", async () => {
    for (const status of ["active", "pending", "blocked"] as const) {
      const [p] = await db.insert(people).values({ email: `${status}@example.com`, status }).returning();
      await expect(resendInvitationCore(deps(), p.id)).rejects.toThrow("Only an invitation that is waiting");
    }
    await expect(resendInvitationCore(deps(), "00000000-0000-4000-8000-000000000000")).rejects.toThrow("not in the list");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("waits an hour between sends, then gives a new code, a new end date, and counts it", async () => {
    const first = await invite();
    await expect(resendInvitationCore(deps({ now: new Date(T0.getTime() + 30 * 60_000) }), first.id)).rejects.toThrow("in 30 minutes");
    expect(sendEmail).toHaveBeenCalledTimes(1);

    await db.update(people).set({ inviteOpenedAt: T0 }).where(eq(people.id, first.id));
    const later = new Date(T0.getTime() + HOUR);
    const outcome = await resendInvitationCore(deps({ now: later }), first.id);
    expect(outcome.result).toBe("sent");
    const row = await person(SOMEONE);
    expect(row.inviteCode).not.toBe(first.inviteCode);
    expect(row).toMatchObject({ status: "invited", inviteSendCount: 2, inviteOpenedAt: null });
    expect(row.inviteExpiresAt?.getTime()).toBe(later.getTime() + 14 * DAY);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sent[1].text).toContain(`invite=${row.inviteCode}`);
    expect(sent[1].text).toContain("See and add Vehicles");
    expect(sent[1].idempotencyKey).not.toBe(sent[0].idempotencyKey);
  });

  it("brings an expired person back to invited", async () => {
    const first = await invite();
    await db.update(people).set({ status: "expired" }).where(eq(people.id, first.id));
    await resendInvitationCore(deps({ now: new Date(T0.getTime() + 20 * DAY) }), first.id);
    expect((await person(SOMEONE)).status).toBe("invited");
  });

  it("stops at 5 sends in total", async () => {
    const first = await invite();
    await db.update(people).set({ inviteSendCount: 5, inviteSentAt: null }).where(eq(people.id, first.id));
    await expect(resendInvitationCore(deps({ now: new Date(T0.getTime() + 2 * HOUR) }), first.id)).rejects.toThrow("5 times already");
  });

  it("counts towards the owner's daily limit", async () => {
    const first = await invite();
    for (let i = 0; i < INVITATION_LIMITS.maxPerOwnerPerDay - 1; i++) await createInvitation(deps(), { email: `q${i}@example.com`, grants: GRANTS });
    await expect(resendInvitationCore(deps({ now: new Date(T0.getTime() + 2 * HOUR) }), first.id)).rejects.toThrow("today's 10");
  });

  it("a dry run puts the last-sent time back", async () => {
    const first = await invite();
    const outcome = await resendInvitationCore(deps({ now: new Date(T0.getTime() + 2 * HOUR), live: false }), first.id);
    expect(outcome.result).toBe("dry-run");
    expect((await person(SOMEONE)).inviteSentAt?.getTime()).toBe(T0.getTime());
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe("withdrawInvitationCore", () => {
  it("deletes an invited or expired placeholder with its grants and any devices keyed by its address", async () => {
    await createInvitation(deps(), { email: SOMEONE, grants: GRANTS });
    await createInvitation(deps(), { email: "gone@example.com", grants: GRANTS });
    const waiting = await person(SOMEONE);
    const expired = await person("gone@example.com");
    await db.update(people).set({ status: "expired" }).where(eq(people.id, expired.id));
    await db.insert(pushSubscriptions).values([
      { recipient: SOMEONE, endpoint: "https://push.example.test/a", p256dh: P256DH, auth: AUTH, deviceLabel: "iPhone" },
      { recipient: "keep@example.com", endpoint: "https://push.example.test/b", p256dh: P256DH, auth: AUTH, deviceLabel: "iPhone" },
    ]);
    expect(await withdrawInvitationCore({ db }, waiting.id)).toBe(true);
    expect(await withdrawInvitationCore({ db }, expired.id)).toBe(true);
    expect(await db.select().from(people)).toHaveLength(0);
    expect(await db.select().from(accessGrants)).toHaveLength(0);
    expect((await db.select().from(pushSubscriptions)).map((s) => s.recipient)).toEqual(["keep@example.com"]);
  });

  it("never touches a person who has joined, a waiting request or a blocked person", async () => {
    const rows = await db
      .insert(people)
      .values([
        { email: "active@example.com", status: "active" },
        { email: "pending@example.com", status: "pending" },
        { email: "blocked@example.com", status: "blocked" },
      ])
      .returning();
    await db.insert(pushSubscriptions).values({ recipient: "active@example.com", endpoint: "https://push.example.test/c", p256dh: P256DH, auth: AUTH, deviceLabel: "iPhone" });
    for (const r of rows) await expect(withdrawInvitationCore({ db }, r.id)).rejects.toThrow("already joined");
    expect(await db.select().from(people)).toHaveLength(3);
    expect(await db.select().from(pushSubscriptions)).toHaveLength(1);
  });

  it("says false for someone who is not there", async () => {
    expect(await withdrawInvitationCore({ db }, "00000000-0000-4000-8000-000000000000")).toBe(false);
  });
});
