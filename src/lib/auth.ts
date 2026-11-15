import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { cache } from "react";
import { ValidationError } from "@/features/shared/validation";
import { isAllowedEmail, parseAllowedEmails } from "./allowed-emails";

/**
 * Who is making this request (Phase 4.1, DECISIONS C61). Signing in is done by Clerk; whether that
 * person may use the hub is decided here, against the `ALLOWED_EMAILS` list. Every page, file link
 * and Server Action goes through this, so a signed-in stranger sees and changes nothing.
 */
export type AuthState =
  | { status: "ok"; userId: string; email: string }
  | { status: "signed-out" }
  | { status: "not-allowed"; email: string | null }
  /** `ALLOWED_EMAILS` is empty or missing: closed to everyone rather than open to everyone. */
  | { status: "not-configured" };

/** Memoised per request, so a page and the actions it calls ask Clerk at most once. */
export const getAuthState = cache(async (): Promise<AuthState> => {
  const allowed = parseAllowedEmails(process.env.ALLOWED_EMAILS);
  if (allowed.length === 0) return { status: "not-configured" };

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
  return isAllowedEmail(email, allowed) ? { status: "ok", userId, email: email as string } : { status: "not-allowed", email };
});

/** Thrown by `requireUser`; a ValidationError so forms show its message instead of a generic one. */
export class AuthError extends ValidationError {}

/** Call first in every Server Action: returns the signed-in, allowed user or throws `AuthError`. */
export async function requireUser(): Promise<{ userId: string; email: string }> {
  const state = await getAuthState();
  if (state.status !== "ok") throw new AuthError("You are not signed in as an allowed user. Reload the page and sign in.");
  return { userId: state.userId, email: state.email };
}
