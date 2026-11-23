import "server-only";
import { db } from "@/db";
import { runDaily, type RunReport } from "./daily";

/**
 * The silent daily run (Notifications N.1, DECISIONS C139), called by /api/notify once a day.
 *
 * There is no signed-in person here, so it cannot use `readDb()` (which would hand it the DEMO
 * database). It reads the REAL database explicitly: the client from "@/db" is passed to the run, which
 * passes it to every reminder source as `{ db, today }` (`ReminderSource.load(from)`) and to the send log.
 * Only the cron route imports this file, after checking CRON_SECRET and that it is production (a test
 * in src/db/read-guard.test.ts checks who imports it).
 */
export type { RunReport };

export function runNotifications(now: Date = new Date()): Promise<RunReport> {
  return runDaily({ db, now, allowedEmails: process.env.ALLOWED_EMAILS });
}
