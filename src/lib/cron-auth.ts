import { timingSafeEqual } from "node:crypto";

/**
 * True when a request comes from our own scheduled job (C127): Vercel Cron sends
 * `Authorization: Bearer <CRON_SECRET>`. Fails closed: no secret configured means nobody passes.
 * Compared in constant time so the secret cannot be guessed from response timing.
 */
export function isCronRequest(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(authorization);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
