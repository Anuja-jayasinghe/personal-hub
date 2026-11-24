import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";
import { db } from "@/db";
import { accessGrants, people } from "@/db/schema";
import { accessFromGrants, allows, AREAS, type Access, type Area, type Level } from "@/features/people/access";
import { ValidationError } from "@/features/shared/validation";
import { safeErrorSummary } from "./errors";
import { isAllowedEmail, parseAllowedEmails } from "./allowed-emails";

/**
 * Who is making this request, and what they may do (Phase 4.1, C61; S.8, C114). Signing in is done by
 * Clerk. The owners are the addresses in `ALLOWED_EMAILS` and may do everything. Anyone else is looked
 * up in the people table: active people get the access the owner gave them per section, someone who
 * signs in unasked is added as pending (waiting for the owner's approval), and blocked people get
 * nothing. Every page, file link and Server Action goes through this.
 */
export type AuthState =
  | { status: "ok"; userId: string; email: string; access: Access; personId: string | null }
  | { status: "signed-out" }
  /** Signed in, not yet approved by the owner (S.8). */
  | { status: "pending"; email: string }
  | { status: "not-allowed"; email: string | null }
  /** `ALLOWED_EMAILS` is empty or missing: closed to everyone rather than open to everyone. */
  | { status: "not-configured" };

const SEEN_EVERY_MS = 60 * 60 * 1000;

/**
 * Tells the owners that someone is waiting for approval (Notifications N.4, C142), right after the pending
 * person is first recorded. It runs after the response (`after()`), so it never delays or breaks sign-in:
 * any failure is swallowed and only its name and code are logged. It is reached only from the line that
 * inserts into the REAL people table for a Clerk-verified person, never for a signed-out visitor or for
 * someone already recorded, and it gets the real client from here (where `@/db` is allowed) instead of
 * `readDb()`, so the demo database is never involved and a demo visitor cannot cause a notice.
 */
function announceAccessRequest(): void {
  try {
    after(async () => {
      try {
        const { notifyAccessRequest } = await import("@/features/notifications/access-request");
        await notifyAccessRequest(db);
      } catch (err) {
        console.error(`Could not announce a sign-up request: ${safeErrorSummary(err)}`);
      }
    });
  } catch (err) {
    console.error(`Could not schedule the sign-up notice: ${safeErrorSummary(err)}`);
  }
}

/** Memoised per request, so a page and the actions it calls ask Clerk and the database at most once. */
export const getAuthState = cache(async (): Promise<AuthState> => {
  const owners = parseAllowedEmails(process.env.ALLOWED_EMAILS);
  if (owners.length === 0) return { status: "not-configured" };

  const { userId, sessionClaims } = await auth();
  if (!userId) return { status: "signed-out" };

  // Fast path: an optional "email" claim added to the session token in the Clerk dashboard.
  // Otherwise ask Clerk for the user's verified primary email address.
  const claim = (sessionClaims as Record<string, unknown> | null | undefined)?.email;
  let email = typeof claim === "string" ? claim : null;
  if (!email) {
    const user = await currentUser();
    const primary = user?.primaryEmailAddress;
    email = primary && primary.verification?.status === "verified" ? primary.emailAddress : null;
  }
  if (isAllowedEmail(email, owners)) return { status: "ok", userId, email: email as string, access: { owner: true }, personId: null };
  if (!email) return { status: "not-allowed", email: null };

  const address = email.trim().toLowerCase();
  // Only the columns it needs: a column added later (notifications_enabled, N.5) must never be able to
  // break sign-in when the code is deployed before its migration.
  const [person] = await db.select({ id: people.id, status: people.status, lastSeenAt: people.lastSeenAt }).from(people).where(eq(people.email, address));
  if (!person) {
    // Signed in by themselves: they wait for the owner's approval (S.8; a demo comes later).
    const created = await db
      .insert(people)
      .values({ email: address, status: "pending", lastSeenAt: new Date() })
      .onConflictDoNothing()
      .returning({ id: people.id });
    // Only the request that really recorded the person tells the owners (N.4, C142): a second sign-in finds the row.
    if (created.length > 0) announceAccessRequest();
    return { status: "pending", email: address };
  }
  if (person.status === "pending") return { status: "pending", email: address };
  if (person.status !== "active") return { status: "not-allowed", email: address };

  const grants = await db.select({ area: accessGrants.area, level: accessGrants.level }).from(accessGrants).where(eq(accessGrants.personId, person.id));
  if (!person.lastSeenAt || Date.now() - person.lastSeenAt.getTime() > SEEN_EVERY_MS) {
    await db.update(people).set({ lastSeenAt: new Date() }).where(eq(people.id, person.id));
  }
  return { status: "ok", userId, email: address, access: accessFromGrants(grants), personId: person.id };
});

/** Thrown by `requireUser`; a ValidationError so forms show its message instead of a generic one. */
export class AuthError extends ValidationError {}

/**
 * What an action or page needs: the owner, at least `level` in `area`, or just "signed-in" when the
 * section depends on the record and is checked right after (files: S.8).
 */
export type Requirement = "owner" | "signed-in" | { area: Area; level: Level };

function meets(access: Access, need: Requirement): boolean {
  if (need === "signed-in") return true;
  return need === "owner" ? access.owner : allows(access, need.area, need.level);
}

/**
 * Call first in every Server Action, saying what it needs (S.8: a test fails if one does not): returns
 * the signed-in, allowed person or throws `AuthError`.
 */
export async function requireUser(need: Requirement): Promise<{ userId: string; email: string; access: Access }> {
  const state = await getAuthState();
  if (state.status !== "ok") throw new AuthError("You are not signed in as an allowed user. Reload the page and sign in.");
  if (!meets(state.access, need)) throw new AuthError("You do not have access to do that. Ask the owner if you need it.");
  return { userId: state.userId, email: state.email, access: state.access };
}

/**
 * The demo (S.9, C118): signed-out visitors and people waiting for approval see the whole hub with
 * sample data from an in-memory database (`src/db/demo`), never the real one. They may look at
 * every section and change nothing: `requireUser` still refuses them, so every Server Action does.
 */
export function isDemoState(state: AuthState): state is Extract<AuthState, { status: "signed-out" | "pending" }> {
  return state.status === "signed-out" || state.status === "pending";
}

/** What the demo may do: see every section, add or change nothing, no owner-only parts. */
export const DEMO_ACCESS: Access = { owner: false, grants: Object.fromEntries(AREAS.map((a) => [a.key, "see"])) };

/** True when this request is looking at the demo. */
export async function isDemo(): Promise<boolean> {
  return isDemoState(await getAuthState());
}

/** The person's access (the demo's for visitors), or null. For pages and components deciding what to show. */
export async function getAccess(): Promise<Access | null> {
  const state = await getAuthState();
  if (state.status === "ok") return state.access;
  return isDemoState(state) ? DEMO_ACCESS : null;
}

/** True when the signed-in person meets `need`. */
export async function can(need: Requirement): Promise<boolean> {
  const access = await getAccess();
  return access !== null && meets(access, need);
}

/** For pages: a part the person may not see answers "not found", as if it were not there. */
export async function requirePage(need: Requirement): Promise<Access> {
  const access = await getAccess();
  if (!access || !meets(access, need)) notFound();
  return access;
}

/** The signed-in person's first name from their account, for the greeting on Home; null when unknown. */
export async function getFirstName(): Promise<string | null> {
  const state = await getAuthState();
  if (state.status !== "ok") return null;
  const user = await currentUser();
  const name = user?.firstName?.trim();
  return name ? name : null;
}
