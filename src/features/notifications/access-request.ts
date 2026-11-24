import "server-only";
import { eq } from "drizzle-orm";
import { appConfig } from "@/config/app.config";
import type { Db } from "@/db/read";
import { appSettings } from "@/db/schema";
import { loadAccessRequestEvents } from "@/features/reminders/sources/access-requests";
import { hourIn, todayIn } from "@/lib/dates";
import { safeErrorSummary } from "@/lib/errors";
import { channelModes, NOTIFICATIONS_SETTINGS_KEY, parseSwitches, type ChannelSender } from "./channels";
import { channelsUsedOn, readLog, usedKeysFrom, writeMessage } from "./log";
import { planNotifications } from "./planner";
import { eventsFor, ownerRecipients } from "./recipients";
import { buildSenders } from "./senders";

/**
 * "Someone asked for access", right away (Notifications N.4, DECISIONS C142).
 *
 * Called ONLY from `getAuthState` (src/lib/auth.ts), through Next's `after()`, at the moment a person who
 * signed in by themselves is first recorded as pending: never from a page, an action or a route (a test
 * checks who imports this file). There is no signed-in person on this path (the person is waiting for
 * approval and must never see or trigger anything), so it takes its authority from where it is called:
 * the REAL database client is passed in by auth.ts after that insert; nothing here can reach `readDb()`
 * and so never the demo; and it only ever writes to the owners (ALLOWED_EMAILS). It takes no input from
 * the person: no name, no email, no id from the request, and the message says nothing about who.
 *
 * It is the daily run's own planner for one kind of event, so every C139 rule holds:
 *  - once per person (dedupe key `access-request:<person id>` in the send log);
 *  - one push per day per owner: if a push already went to them today, nothing is sent now and the
 *    request is HELD, the same way N.3 holds "stopped accepting pushes": nothing is written, the pending
 *    person row is the held notice, and the next daily run puts it in that day's single push (its window
 *    runs 7 days);
 *  - before the morning run has had its day (see MORNING_RUN_DONE_HOUR) it is held too, so an early
 *    sign-up never uses up the day's push before the run's "due today" notices;
 *  - production only, like the daily run: previews and local development share the real database but
 *    must never notify (the daily run announces the request later, if it is still pending).
 * Retries only when nothing went out (the log's `failed` rows, at most three); an unknown outcome is
 * never repeated.
 */

/** The daily run fires between 07:30 and 08:29 in Colombo; until this hour a sign-up waits for it. */
export const MORNING_RUN_DONE_HOUR = 9;

export type AccessRequestReport = {
  /** Not production (a preview, local development): nothing was done. */
  skipped: boolean;
  /** Owners whose sign-up notice was held for the daily run (push already used today, or before the morning run). */
  held: number;
  /** Owners a message was written for: sent, or logged as a dry run while push is not live. */
  written: number;
  sent: number;
  /** Owners whose part threw; the others still ran. */
  failed: number;
};

export type AccessRequestDeps = {
  now?: Date;
  /** `process.env.VERCEL_ENV`. */
  environment?: string;
  allowedEmails?: string;
  senders?: Record<"email" | "push", ChannelSender>;
};

export async function notifyAccessRequest(db: Db, deps: AccessRequestDeps = {}): Promise<AccessRequestReport> {
  const { now = new Date(), environment = process.env.VERCEL_ENV, allowedEmails = process.env.ALLOWED_EMAILS } = deps;
  const report: AccessRequestReport = { skipped: false, held: 0, written: 0, sent: 0, failed: 0 };
  if (environment !== "production") return { ...report, skipped: true };

  const today = todayIn(appConfig.timeZone, now);
  const recipients = ownerRecipients(allowedEmails);
  const events = await loadAccessRequestEvents(db);
  if (events.length === 0 || recipients.length === 0) return report;

  if (hourIn(appConfig.timeZone, now) < MORNING_RUN_DONE_HOUR) {
    report.held = recipients.length;
    return report;
  }

  const senders = deps.senders ?? buildSenders(db);
  const [setting] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, NOTIFICATIONS_SETTINGS_KEY));
  const modes = channelModes(parseSwitches(setting?.value ?? null), senders);

  for (const recipient of recipients) {
    try {
      const log = await readLog(db, recipient.email);
      const plan = planNotifications({
        recipient: recipient.email,
        items: [],
        events: eventsFor(recipient, [{ area: "owner", items: events }]),
        today,
        usedKeys: usedKeysFrom(log, modes),
        channelsUsedToday: channelsUsedOn(log, modes, today, appConfig.timeZone),
      });
      report.held += plan.held;
      const message = plan.messages.find((m) => m.channel === "push");
      if (!message) continue;
      const result = await writeMessage(db, message, modes.push, senders.push, { today });
      if (result.written > 0) report.written++;
      report.sent += result.sent > 0 ? 1 : 0;
    } catch (err) {
      report.failed++;
      // Name and code only: the error may carry an address.
      console.error(`Sign-up notice failed for one owner: ${safeErrorSummary(err)}`);
    }
  }
  return report;
}
