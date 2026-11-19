/** Checks for Settings › People and roles (S.8, C114). Pure. */

export function parsePersonEmail(raw: string | null | undefined): { ok: true; email: string } | { ok: false; error: string } {
  const email = (raw ?? "").trim().toLowerCase();
  if (!email) return { ok: false, error: "Type their email address." };
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "That does not look like an email address." };
  return { ok: true, email };
}

export function parsePersonName(raw: string | null | undefined): string | null {
  const name = (raw ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  return name || null;
}
