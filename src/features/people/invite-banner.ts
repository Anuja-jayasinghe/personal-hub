import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import type { Db } from "@/db/read";
import { people } from "@/db/schema";
import { safeErrorSummary } from "@/lib/errors";
import { INVITE_CODE_RE } from "./invitation-config";

/**
 * The friendly line above the sign-up form: "<first name> invited you to hub" (issue #236, DECISIONS C154).
 * The sign-up page is public: nobody is signed in, so this takes its authority from what it is given.
 * What it may know is tiny on purpose: the code is only a lookup key (it is NOT a credential, the gate is
 * the verified email at sign-in), it answers with the inviter's first name or nothing, it never returns
 * or confirms an address, and an unknown, malformed, expired or already-used code looks exactly like no
 * code at all. Marking the invitation "opened" is advisory (a link preview can do it too) and happens
 * after the response, once, and can never break the page.
 */
export type InvitationBanner = { inviterName: string | null };

/** The pure lookup (a database handle in, a banner or null out), for the page's wrapper and for tests. */
export async function findInvitationBanner(handle: Db, code: unknown, now: Date): Promise<InvitationBanner | null> {
  if (typeof code !== "string" || !INVITE_CODE_RE.test(code)) return null;
  const [row] = await handle
    .select({ inviterName: people.inviterName })
    .from(people)
    .where(and(eq(people.inviteCode, code), eq(people.status, "invited"), gt(people.inviteExpiresAt, now)));
  return row ? { inviterName: row.inviterName } : null;
}

/** Records the first time a valid invitation link was opened. Idempotent: only an empty `invite_opened_at` is set. */
export async function markInvitationOpened(handle: Db, code: string, now: Date): Promise<void> {
  await handle
    .update(people)
    .set({ inviteOpenedAt: now })
    .where(and(eq(people.inviteCode, code), eq(people.status, "invited"), gt(people.inviteExpiresAt, now), isNull(people.inviteOpenedAt)));
}

/** For the sign-up page: the banner for `?invite=<code>`, or null. Never throws. */
export async function invitationBannerFor(code: unknown): Promise<InvitationBanner | null> {
  try {
    const now = new Date();
    const banner = await findInvitationBanner(db, code, now);
    if (banner && typeof code === "string") {
      after(async () => {
        try {
          await markInvitationOpened(db, code, new Date());
        } catch (err) {
          console.error(`Could not mark an invitation opened: ${safeErrorSummary(err)}`);
        }
      });
    }
    return banner;
  } catch (err) {
    console.error(`Could not look up an invitation: ${safeErrorSummary(err)}`);
    return null;
  }
}
