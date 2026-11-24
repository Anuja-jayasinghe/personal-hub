import { eq } from "drizzle-orm";
import { appConfig } from "@/config/app.config";
import type { Db } from "@/db/read";
import { appSettings } from "@/db/schema";
import type { NoticeSource, ReminderSource } from "@/features/reminders/engine";
import { loadSources, noticeSources as defaultNoticeSources, reminderSources } from "@/features/reminders/sources";
import { todayIn } from "@/lib/dates";
import { safeErrorSummary } from "@/lib/errors";
import { channelModes, NOTIFICATIONS_SETTINGS_KEY, parseSwitches, SENDERS, type ChannelModes, type ChannelSender } from "./channels";
import { channelsUsedOn, pruneLog, readLog, rowCounts, usedKeysFrom, writeMessage } from "./log";
import { planNotifications } from "./planner";
import { clearLoggedGone, pushGoneNotices, withGoneNotices } from "./push/gone";
import { eventsFor, itemsFor, ownerRecipients } from "./recipients";
import { CHANNELS, type Channel } from "./steps";

/**
 * The daily notification run (Notifications N.1, DECISIONS C139), with everything it depends on passed
 * in: the database, the moment, the ALLOWED_EMAILS value, the sources and the senders. The cron route
 * reaches it only through run.ts, which passes the real database; the tests pass an in-memory one.
 *
 * Nothing new means nothing written and nothing sent (pruning old rows is housekeeping). A source that
 * fails or a recipient that fails is counted and the rest carry on. The report is counts only.
 */

export type DailyDeps = {
  db: Db;
  now: Date;
  allowedEmails: string | undefined;
  sources?: readonly ReminderSource[];
  /** Events happening now (N.4): a slab limit, a reading overdue, a sign-up request. */
  noticeSources?: readonly NoticeSource[];
  senders?: Record<Channel, ChannelSender>;
};

export type RunReport = {
  today: string;
  modes: ChannelModes;
  recipients: number;
  /** Recipients whose part of the run threw; the others still ran. */
  failedRecipients: number;
  items: number;
  /** Events happening now (N.4) from the sources, before the planner picks the ones due. */
  events: number;
  failedSources: number;
  notices: Record<Channel, number>;
  messages: Record<Channel, number>;
  /** Notices held back because a message already went on that channel today. */
  held: number;
  rows: { dryRun: number; sent: number; failed: number; unknown: number };
  /** Messages (one per recipient, day and channel) logged so far this month, for the budget of about 4 to 8 each. */
  thisMonth: Record<Channel, number>;
  pruned: number;
};

export async function runDaily({ db, now, allowedEmails, sources = reminderSources, noticeSources = defaultNoticeSources, senders = SENDERS }: DailyDeps): Promise<RunReport> {
  const today = todayIn(appConfig.timeZone, now);
  const [setting] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, NOTIFICATIONS_SETTINGS_KEY));
  const modes = channelModes(parseSwitches(setting?.value ?? null), senders);
  const recipients = ownerRecipients(allowedEmails);

  const pruned = await pruneLog(db, now);
  const { loaded, failedSources: failedItemSources } = await loadSources(sources, { db, today });
  const { loaded: loadedEvents, failedSources: failedEventSources } = await loadSources(noticeSources, { db, today });
  const failedSources = [...failedItemSources, ...failedEventSources];

  const report: RunReport = {
    today,
    modes,
    recipients: recipients.length,
    failedRecipients: 0,
    items: loaded.reduce((n, l) => n + l.items.length, 0),
    events: loadedEvents.reduce((n, l) => n + l.items.length, 0),
    failedSources: failedSources.length,
    notices: { email: 0, push: 0 },
    messages: { email: 0, push: 0 },
    held: 0,
    rows: { dryRun: 0, sent: 0, failed: 0, unknown: 0 },
    thisMonth: { email: 0, push: 0 },
    pruned,
  };

  for (const recipient of recipients) {
    try {
      const log = await readLog(db, recipient.email);
      const usedToday = channelsUsedOn(log, modes, today, appConfig.timeZone);
      const plan = planNotifications({
        recipient: recipient.email,
        items: itemsFor(recipient, loaded),
        events: eventsFor(recipient, loadedEvents),
        today,
        usedKeys: usedKeysFrom(log, modes),
        channelsUsedToday: usedToday,
      });
      report.held += plan.held;

      // A device that stopped accepting pushes since the last email (N.3, C140): its one notice joins
      // today's email, or is held for tomorrow if an email already went today.
      const gone = await pushGoneNotices(db, recipient.email, today);
      const messages = withGoneNotices(recipient.email, plan.messages, gone, usedToday.has("email"));
      if (gone.length > 0 && usedToday.has("email")) report.held += gone.length;

      for (const message of messages) {
        const mode = modes[message.channel];
        const result = await writeMessage(db, message, mode, senders[message.channel]);
        if (!result.message) continue;
        report.messages[message.channel]++;
        report.notices[message.channel] += result.message.notices.length;
        if (mode === "dry") report.rows.dryRun += result.written;
        report.rows.sent += result.sent;
        report.rows.failed += result.failed;
        report.rows.unknown += result.unknown;
      }
      if (gone.length > 0) await clearLoggedGone(db, recipient.email);

      // The month's budget: distinct days with a message, per channel (today's included).
      const month = today.slice(0, 7);
      const after = await readLog(db, recipient.email);
      for (const channel of CHANNELS) {
        const days = new Set(
          after
            .filter((r) => r.channel === channel && rowCounts(r, modes))
            .map((r) => todayIn(appConfig.timeZone, r.createdAt))
            .filter((d) => d.startsWith(month)),
        );
        report.thisMonth[channel] += days.size;
      }
    } catch (err) {
      report.failedRecipients++;
      // Name and code only: the error may carry the recipient's address and the notices' words.
      console.error(`Notification run failed for one recipient: ${safeErrorSummary(err)}`);
    }
  }

  return report;
}
