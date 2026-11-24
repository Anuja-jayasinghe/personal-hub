import { and, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import type { Db } from "@/db/read";
import { people } from "@/db/schema";

/**
 * Turns an invited person into an active one the moment they sign in with the invited address (issue
 * #236, DECISIONS C154). Called ONLY by `getAuthState` (src/lib/auth.ts), after Clerk has verified the
 * address; it does not check who is calling, so never call it from anywhere else.
 *
 * Each step is ONE conditional UPDATE ... RETURNING, so two tabs signing in at the same moment cannot
 * both win: exactly one request gets the row back.
 *  - `activated`: the row was `invited` and its expiry is still in the future (strictly: at the exact
 *    expiry moment it is over). It is now `active` with exactly the grants already stored, last seen now.
 *    The invitation columns stay as the record of who invited them; only `invite_opened_at` is filled
 *    when it is still empty (they plainly opened it).
 *  - `expired`: the row was `invited` but past its expiry (or has none): it is now `expired` and has no
 *    power; the caller treats the sign-in as an ordinary request (see `requestAccessAfterExpiry`).
 *  - `none`: no `invited` row for this address (or another request changed it first).
 */
export type Activation = { result: "activated"; personId: string } | { result: "expired" } | { result: "none" };

export async function activateInvitedPerson(db: Db, email: string, now: Date): Promise<Activation> {
  const address = email.trim().toLowerCase();
  const [activated] = await db
    .update(people)
    .set({ status: "active", lastSeenAt: now, updatedAt: now, inviteOpenedAt: sql`coalesce(${people.inviteOpenedAt}, ${now.toISOString()}::timestamptz)` })
    .where(and(eq(people.email, address), eq(people.status, "invited"), gt(people.inviteExpiresAt, now)))
    .returning({ id: people.id });
  if (activated) return { result: "activated", personId: activated.id };

  const [expired] = await db
    .update(people)
    .set({ status: "expired", updatedAt: now })
    .where(and(eq(people.email, address), eq(people.status, "invited"), or(isNull(people.inviteExpiresAt), lte(people.inviteExpiresAt, now))))
    .returning({ id: people.id });
  return expired ? { result: "expired" } : { result: "none" };
}

/**
 * An `expired` person signing in is an ordinary new request: the row becomes `pending` (it then appears
 * under "Waiting for you", with the grants the owner chose still stored, so approving them uses those)
 * and `created_at` becomes now, because that is the moment the request began (the sign-up push and its
 * window count from it). Returns true only for the single request that made the change, which is the one
 * that announces it to the owners (src/features/notifications/access-request.ts dedupes per person).
 */
export async function requestAccessAfterExpiry(db: Db, email: string, now: Date): Promise<boolean> {
  const address = email.trim().toLowerCase();
  const changed = await db
    .update(people)
    .set({ status: "pending", createdAt: now, lastSeenAt: now, updatedAt: now })
    .where(and(eq(people.email, address), eq(people.status, "expired")))
    .returning({ id: people.id });
  return changed.length > 0;
}
