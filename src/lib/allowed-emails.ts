/**
 * Who may use the hub (Phase 4.1, DECISIONS C61). The owner's address(es) live in the
 * `ALLOWED_EMAILS` environment variable, a comma separated list. This list, not any Clerk setting,
 * is the real gate: a stranger who manages to sign up still gets nothing. It fails closed: with no
 * valid address in the list, nobody is allowed. Pure.
 */

/** "a@x.com, B@Y.com" -> ["a@x.com", "b@y.com"]. Splits on commas, semicolons and whitespace; ignores entries without an "@". */
export function parseAllowedEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^@\s]+@[^@\s]+$/.test(e));
}

/** True when `email` is on the list (compared case-insensitively). An empty list allows nobody. */
export function isAllowedEmail(email: string | null | undefined, allowed: readonly string[]): boolean {
  if (!email || allowed.length === 0) return false;
  return allowed.includes(email.trim().toLowerCase());
}
