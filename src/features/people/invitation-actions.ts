"use server";

import { refresh } from "next/cache";
import { db } from "@/db";
import { appConfig } from "@/config/app.config";
import { NotSentError } from "@/features/notifications/channels";
import { toActionState } from "@/features/shared/errors";
import type { ActionState } from "@/features/shared/types";
import { idFrom } from "@/features/shared/validation";
import { parseAllowedEmails } from "@/lib/allowed-emails";
import { getFirstName, requireUser } from "@/lib/auth";
import { AREAS } from "./access";
import { invitationEmailSetup, invitationsAreLive, inviterFirstName, sendInvitationEmail } from "./invitation-email";
import { createInvitation, outcomeState, resendInvitationCore, withdrawInvitationCore, type InvitationDeps } from "./invitations";

// Settings › People › Invite someone (issue #236, DECISIONS C154). Owner only. These are thin on purpose:
// the logic is in invitations.ts, with its dependencies passed in.

/** The real dependencies: the real database, the live-site gate, Resend with the real key. */
async function realDeps(inviterEmail: string): Promise<InvitationDeps> {
  const setup = invitationEmailSetup(process.env);
  return {
    db,
    now: new Date(),
    siteUrl: appConfig.siteUrl,
    inviter: { email: inviterEmail, firstName: inviterFirstName(await getFirstName()) },
    ownerEmails: parseAllowedEmails(process.env.ALLOWED_EMAILS),
    live: invitationsAreLive(process.env),
    sendEmail: async (message) => {
      if (!setup) throw new NotSentError("Email is not set up (RESEND_API_KEY is missing)");
      await sendInvitationEmail(setup, message);
    },
  };
}

/** Invites someone: saves them as a waiting person with the chosen access, then emails the sign-up link. */
export async function inviteSomeone(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { email } = await requireUser("owner");
    // One field per section ("access:<section>" = see | add | edit | hidden), as the form's grid sets them.
    const grants: Record<string, unknown> = {};
    for (const a of AREAS) grants[a.key] = String(fd.get(`access:${a.key}`) ?? "hidden");
    const outcome = await createInvitation(await realDeps(email), { email: String(fd.get("email") ?? ""), name: String(fd.get("name") ?? ""), grants });
    refresh();
    return outcomeState(outcome);
  } catch (err) {
    return toActionState(err);
  }
}

/** Sends a waiting invitation again (a new code and a new end date). */
export async function resendInvitation(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { email } = await requireUser("owner");
    const outcome = await resendInvitationCore(await realDeps(email), idFrom(fd));
    refresh();
    return outcomeState(outcome);
  } catch (err) {
    return toActionState(err);
  }
}

/** Withdraws a waiting invitation: deletes the placeholder. Never touches a person who has joined. */
export async function withdrawInvitation(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser("owner");
    await withdrawInvitationCore({ db }, idFrom(fd));
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}
