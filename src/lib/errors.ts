/**
 * A short, safe description of an error for the server log: its name and, when it has one, the
 * database error code (e.g. "DrizzleQueryError (23505)"). Never the message: a failed query's message
 * holds the query's parameters (emails, titles), which must not end up in the logs. Pure.
 */
export function safeErrorSummary(err: unknown): string {
  if (!(err instanceof Error)) return typeof err;
  const code = codeOf(err) ?? codeOf(err.cause);
  return code ? `${err.name} (${code})` : err.name;
}

function codeOf(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const code = (value as { code?: unknown }).code;
  return typeof code === "string" && /^[A-Za-z0-9_]{1,16}$/.test(code) ? code : null;
}
