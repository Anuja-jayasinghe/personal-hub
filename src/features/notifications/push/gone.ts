import { eq } from "drizzle-orm";
import { appConfig } from "@/config/app.config";
import type { Db } from "@/db/read";
import { appSettings } from "@/db/schema";
import { todayIn } from "@/lib/dates";
import { NOTIFICATIONS_SETTINGS_KEY, parseSwitches, type ChannelModes, type ChannelSender } from "../channels";
import { channelsUsedOn, readLog, writeMessage, type WriteResult } from "../log";
import { systemMessage } from "../system";

/**
 * "iPhone stopped accepting pushes" (Notifications N.3, DECISIONS C140). When a push service answers
 * 404 or 410 the subscription is gone for good (the hub was removed from the Home Screen, or iOS reset
 * it): the sender deletes it and this writes ONE email notice through the send log, so the owner knows
 * pushes stopped. Per C139 a notice uses one channel, and email is the only other one.
 *
 *  - Once per broken subscription: its dedupe key is `push-gone:<subscription id>` (a uuid, deleted
 *    with the row, so it never comes back), and the log's unique indexes refuse a second row.
 *  - One email a day: if an email already went to this person today, the notice is logged as not sent
 *    (a dry-run row, shown in Settings) instead of sending a second email.
 *  - A dry run until N.2 builds the email sender and the owner switches email on.
 */

export const pushGoneDedupeKey = (subscriptionId: string) => `push-gone:${subscriptionId}`;

export function pushGoneText(deviceLabel: string): { title: string; body: string; href: string } {
  return {
    title: `${deviceLabel} stopped accepting pushes`,
    body: `${deviceLabel} stopped accepting pushes from ${appConfig.name}, so it was removed. To get them again, open ${appConfig.name} from the Home Screen and turn pushes on in Settings › Notifications.`,
    href: "/settings/notifications",
  };
}

export async function recordPushGone(
  db: Db,
  input: { recipient: string; subscriptionId: string; deviceLabel: string; now: Date; emailSender: Pick<ChannelSender, "implemented" | "send"> },
): Promise<WriteResult> {
  const { recipient, subscriptionId, deviceLabel, now, emailSender } = input;
  const today = todayIn(appConfig.timeZone, now);
  const [setting] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, NOTIFICATIONS_SETTINGS_KEY));
  const live = emailSender.implemented && parseSwitches(setting?.value ?? null).email.enabled;
  // Only email matters here; push is given as live so its rows never hide an email row.
  const modes: ChannelModes = { email: live ? "live" : "dry", push: "live" };
  const emailedToday = live && channelsUsedOn(await readLog(db, recipient), modes, today, appConfig.timeZone).has("email");
  const message = systemMessage({
    recipient,
    channel: "email",
    kind: "push-gone",
    dedupeKey: pushGoneDedupeKey(subscriptionId),
    today,
    ...pushGoneText(deviceLabel),
  });
  return writeMessage(db, message, live && !emailedToday ? "live" : "dry", emailSender);
}
