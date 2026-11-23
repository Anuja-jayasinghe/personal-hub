import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { appConfig } from "@/config/app.config";
import type { Db } from "@/db/read";
import { appSettings, notifications, pushSubscriptions } from "@/db/schema";
import { todayIn } from "@/lib/dates";
import { NOTIFICATIONS_SETTINGS_KEY, parseSwitches, type ChannelModes, type ChannelSender } from "../channels";
import { channelsUsedOn, MAX_FAILED_TRIES, readLog, writeMessage, type WriteResult } from "../log";
import { composeMessage, type Message, type Notice } from "../planner";
import { systemNotice } from "../system";

/**
 * "iPhone stopped accepting pushes" (Notifications N.3, DECISIONS C140). When a push service answers
 * 404 or 410 the subscription is gone for good (the hub was removed from the Home Screen, or iOS reset
 * it). The sender marks it `gone_at` (nothing is sent to it again) and ONE email notice is logged
 * through the send log, so the owner knows pushes stopped. Per C139 a notice uses one channel, and
 * email is the only other one.
 *
 *  - Once per broken subscription: the key is `push-gone:<subscription id>` and the log's unique
 *    indexes refuse a second row; once the notice is logged the subscription row is deleted.
 *  - One email a day: if an email already went to this person today, the notice is HELD: the row stays
 *    marked gone and the next daily run puts it into that day's email (batched with anything else).
 *  - A dry run until N.2 builds the email sender and the owner switches email on. The email sender is
 *    the one the run was given (passed in), so N.2's sender plugs in without touching this file.
 */

export const pushGoneDedupeKey = (subscriptionId: string) => `push-gone:${subscriptionId}`;

export function pushGoneText(deviceLabel: string): { title: string; body: string; href: string } {
  return {
    title: `${deviceLabel} stopped accepting pushes`,
    body: `${deviceLabel} stopped accepting pushes from ${appConfig.name}, so it was removed. To get them again, open ${appConfig.name} from the Home Screen and turn pushes on in Settings › Notifications.`,
    href: "/settings/notifications",
  };
}

/** One email notice per subscription of this person that is marked gone and not yet logged. */
export async function pushGoneNotices(db: Db, recipient: string, today: string): Promise<Notice[]> {
  const gone = await db
    .select({ id: pushSubscriptions.id, deviceLabel: pushSubscriptions.deviceLabel })
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.recipient, recipient), isNotNull(pushSubscriptions.goneAt)));
  return gone.map((g) => systemNotice({ channel: "email", kind: "push-gone", dedupeKey: pushGoneDedupeKey(g.id), today, ...pushGoneText(g.deviceLabel) }));
}

/**
 * Deletes this person's gone subscriptions whose notice is logged (dry run, pending or sent), or was
 * refused MAX_FAILED_TRIES times. A notice that was refused fewer times keeps its row, so the next run
 * tries again. Returns how many were deleted.
 */
export async function clearLoggedGone(db: Db, recipient: string): Promise<number> {
  const gone = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.recipient, recipient), isNotNull(pushSubscriptions.goneAt)));
  if (gone.length === 0) return 0;
  const keys = gone.map((g) => pushGoneDedupeKey(g.id));
  const rows = await db
    .select({ key: notifications.dedupeKey, status: notifications.status })
    .from(notifications)
    .where(and(eq(notifications.recipient, recipient), inArray(notifications.dedupeKey, keys)));
  const done = gone.filter((g) => {
    const mine = rows.filter((r) => r.key === pushGoneDedupeKey(g.id));
    return mine.some((r) => r.status !== "failed") || mine.filter((r) => r.status === "failed").length >= MAX_FAILED_TRIES;
  });
  if (done.length === 0) return 0;
  const deleted = await db
    .delete(pushSubscriptions)
    .where(inArray(pushSubscriptions.id, done.map((d) => d.id)))
    .returning({ id: pushSubscriptions.id });
  return deleted.length;
}

/**
 * For the daily run: adds the held notices to the planned email (one email a day: batched with it, or
 * an email of their own when nothing else is planned). Held back while an email already went today. Pure.
 */
export function withGoneNotices(recipient: string, messages: readonly Message[], gone: readonly Notice[], emailedToday: boolean): Message[] {
  if (gone.length === 0 || emailedToday) return [...messages];
  const email = messages.find((m) => m.channel === "email");
  const merged = composeMessage(recipient, "email", [...(email?.notices ?? []), ...gone]);
  return [merged, ...messages.filter((m) => m.channel !== "email")];
}

export type GoneOutcome = { status: "none" } | { status: "held" } | { status: "logged"; result: WriteResult };

/**
 * Logs (and, when email is live, sends) the notice for every gone subscription of this person, right
 * away, unless an email already went to them today: then they are held for the next daily run.
 */
export async function deliverGoneNotices(
  db: Db,
  input: { recipient: string; now: Date; emailSender: Pick<ChannelSender, "implemented" | "send"> },
): Promise<GoneOutcome> {
  const { recipient, now, emailSender } = input;
  const today = todayIn(appConfig.timeZone, now);
  const notices = await pushGoneNotices(db, recipient, today);
  if (notices.length === 0) return { status: "none" };
  const [setting] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, NOTIFICATIONS_SETTINGS_KEY));
  const mode = emailSender.implemented && parseSwitches(setting?.value ?? null).email.enabled ? "live" : "dry";
  // Only email matters here; push is given as live so its rows never count as email.
  const modes: ChannelModes = { email: mode, push: "live" };
  if (channelsUsedOn(await readLog(db, recipient), modes, today, appConfig.timeZone).has("email")) return { status: "held" };
  const result = await writeMessage(db, composeMessage(recipient, "email", notices), mode, emailSender);
  await clearLoggedGone(db, recipient);
  return { status: "logged", result };
}
