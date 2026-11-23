import "server-only";
import { desc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { readDb } from "@/db/read";
import { appSettings, notifications } from "@/db/schema";
import { loadSources, reminderSources } from "@/features/reminders/sources";
import { getAuthState } from "@/lib/auth";
import { todayInAppTz } from "@/lib/format";
import { channelModes, NOTIFICATIONS_SETTINGS_KEY, parseSwitches, type ChannelModes } from "./channels";
import { readLog, usedKeysFrom } from "./log";
import { previewUpcoming, type PreviewDay } from "./planner";

/** Settings › Notifications (owner only, N.1): what would go out next, and the send log. */

/** How far ahead "Coming up" looks. */
export const COMING_UP_DAYS = 30;

async function modesFrom(db: Awaited<ReturnType<typeof readDb>>): Promise<ChannelModes> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, NOTIFICATIONS_SETTINGS_KEY));
  return channelModes(parseSwitches(row?.value ?? null));
}

/**
 * What the daily run would send the person looking at the page over the next COMING_UP_DAYS days, if
 * nothing changes. Owners see every source, like the run.
 */
export async function getComingUp(): Promise<{ today: string; days: PreviewDay[]; failedSources: string[]; modes: ChannelModes }> {
  await connection();
  const db = await readDb();
  const state = await getAuthState();
  const recipient = state.status === "ok" ? state.email.trim().toLowerCase() : "";
  const today = todayInAppTz();
  const [modes, log, { loaded, failedSources }] = await Promise.all([modesFrom(db), readLog(db, recipient), loadSources(reminderSources)]);
  const items = loaded.flatMap((l) => l.items);
  return { today, days: previewUpcoming(items, today, usedKeysFrom(log, modes), COMING_UP_DAYS), failedSources, modes };
}

/** The newest rows of the send log, every recipient. */
export async function listRecentNotifications(limit = 20) {
  await connection();
  const db = await readDb();
  return db
    .select({
      id: notifications.id,
      channel: notifications.channel,
      title: notifications.title,
      status: notifications.status,
      error: notifications.error,
      createdAt: notifications.createdAt,
      sentAt: notifications.sentAt,
    })
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export type RecentNotification = Awaited<ReturnType<typeof listRecentNotifications>>[number];
