import { isCronRequest } from "@/lib/cron-auth";

/**
 * Who may start the daily notification run (C127, C139). Our own Vercel Cron job only (the bearer
 * CRON_SECRET, fails closed), and only on production: previews use real data (C133) and must never
 * notify, so anywhere else the run is skipped. The secret is checked first. Pure.
 */
export type NotifyGate = "unauthorized" | "skipped" | "run";

export function notifyGate(authorization: string | null, env: { CRON_SECRET?: string; VERCEL_ENV?: string }): NotifyGate {
  if (!isCronRequest(authorization, env.CRON_SECRET)) return "unauthorized";
  if (env.VERCEL_ENV !== "production") return "skipped";
  return "run";
}
