import "server-only";
import { eq } from "drizzle-orm";
import { appConfig } from "@/config/app.config";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { loadSources, reminderSources } from "@/features/reminders/sources";
import { todayIn } from "@/lib/dates";
import { channelModes, NOTIFICATIONS_SETTINGS_KEY, parseSwitches, SENDERS, type ChannelModes } from "./channels";
import { channelsUsedOn, pruneLog, readLog, rowCounts, usedKeysFrom, writeMessage } from "./log";
import { planNotifications } from "./planner";
import { itemsFor, ownerRecipients } from "./recipients";
import type { Channel } from "./steps";

/**
 * The silent daily run (Notifications N.1, DECISIONS C139), called by /api/notify once a day.
 *
 * There is no signed-in person here, so it cannot use `readDb()` (which would hand it the DEMO
 * database). It reads the REAL database explicitly: the client from "@/db" is passed to every reminder
 * source as `{ db, today }` (`ReminderSource.load(from)`), and to the send log. Only this file and the
 * route that calls it (after checking CRON_SECRET and that it is production) reach it.
 *
 * Nothing new means nothing written and nothing sent. The answer is counts only, never data.
 */

export type RunReport = {
  today: string;
  modes: ChannelModes;
  recipients: number;
  items: number;
  failedSources: number;
  notices: Record<Channel, number>;
  messages: Record<Channel, number>;
  /** Notices held back because a message already went on that channel today. */
  held: number;
  rows: { dryRun: number; sent: number; failed: number };
  /** Messages (one per recipient, day and channel) logged so far this month, for the budget of about 4 to 8 each. */
  thisMonth: Record<Channel, number>;
  pruned: number;
};

export async function runNotifications(now: Date = new Date()): Promise<RunReport> {
  const today = todayIn(appConfig.timeZone, now);
  const [setting] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, NOTIFICATIONS_SETTINGS_KEY));
  const modes = channelModes(parseSwitches(setting?.value ?? null));
  const recipients = ownerRecipients(process.env.ALLOWED_EMAILS);

  const pruned = await pruneLog(db, now);
  const { loaded, failedSources } = await loadSources(reminderSources, { db, today });

  const report: RunReport = {
    today,
    modes,
    recipients: recipients.length,
    items: loaded.reduce((n, l) => n + l.items.length, 0),
    failedSources: failedSources.length,
    notices: { email: 0, push: 0 },
    messages: { email: 0, push: 0 },
    held: 0,
    rows: { dryRun: 0, sent: 0, failed: 0 },
    thisMonth: { email: 0, push: 0 },
    pruned,
  };

  for (const recipient of recipients) {
    const log = await readLog(db, recipient.email);
    const plan = planNotifications({
      recipient: recipient.email,
      items: itemsFor(recipient, loaded),
      today,
      usedKeys: usedKeysFrom(log, modes),
      channelsUsedToday: channelsUsedOn(log, modes, today, appConfig.timeZone),
    });
    report.held += plan.held;

    for (const message of plan.messages) {
      const mode = modes[message.channel];
      const result = await writeMessage(db, message, mode, SENDERS[message.channel]);
      if (!result.message) continue;
      report.messages[message.channel]++;
      report.notices[message.channel] += result.message.notices.length;
      if (mode === "dry") report.rows.dryRun += result.written;
      report.rows.sent += result.sent;
      report.rows.failed += result.failed;
    }

    // The month's budget: distinct days with a message, per channel (today's included).
    const month = today.slice(0, 7);
    const after = await readLog(db, recipient.email);
    for (const channel of ["email", "push"] as const) {
      const days = new Set(
        after
          .filter((r) => r.channel === channel && rowCounts(r, modes))
          .map((r) => todayIn(appConfig.timeZone, r.createdAt))
          .filter((d) => d.startsWith(month)),
      );
      report.thisMonth[channel] += days.size;
    }
  }

  return report;
}
