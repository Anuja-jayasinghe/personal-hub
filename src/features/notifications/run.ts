import "server-only";
import { db } from "@/db";
import { SENDERS } from "./channels";
import { runDaily, type RunReport } from "./daily";
import { vapidFromEnv } from "./push/config";
import { createPushSender } from "./push/sender";
import { webPushTransport } from "./push/transport";

/**
 * The silent daily run (Notifications N.1, DECISIONS C139), called by /api/notify once a day.
 *
 * There is no signed-in person here, so it cannot use `readDb()` (which would hand it the DEMO
 * database). It reads the REAL database explicitly: the client from "@/db" is passed to the run, which
 * passes it to every reminder source as `{ db, today }` (`ReminderSource.load(from)`), to the send log
 * and to the push sender (N.3, C140). Push is only implemented when the VAPID keys are set; it goes live
 * only when the owner also switched it on in Settings. Only the cron route imports this file, after
 * checking CRON_SECRET and that it is production (a test in src/db/read-guard.test.ts checks who imports it).
 */
export type { RunReport };

export function runNotifications(now: Date = new Date()): Promise<RunReport> {
  const vapid = vapidFromEnv();
  const push = createPushSender({ db, transport: vapid ? webPushTransport(vapid) : null });
  return runDaily({ db, now, allowedEmails: process.env.ALLOWED_EMAILS, senders: { email: SENDERS.email, push } });
}
