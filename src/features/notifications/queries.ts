import "server-only";
import { desc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { appConfig } from "@/config/app.config";
import { readDb, type Db } from "@/db/read";
import { appSettings, notifications } from "@/db/schema";
import { loadSources, reminderSources } from "@/features/reminders/sources";
import { getAuthState, requirePage } from "@/lib/auth";
import { todayInAppTz } from "@/lib/format";
import { channelModes, NOTIFICATIONS_SETTINGS_KEY, parseSwitches, type ChannelModes } from "./channels";
import { channelsUsedOn, readLog, shownStatus, usedKeysFrom } from "./log";
import { previewUpcoming, type PreviewDay } from "./planner";

/**
 * Settings › Notifications (owner only, N.1): what would go out next, and the send log. Each query
 * checks the owner itself, not only the Settings layout: a partial page request can skip the layout,
 * and `readDb()` alone would hand a signed-in person the real database.
 */

/** How far ahead "Coming up" looks. */
export const COMING_UP_DAYS = 30;

async function modesFrom(db: Db): Promise<ChannelModes> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, NOTIFICATIONS_SETTINGS_KEY));
  return channelModes(parseSwitches(row?.value ?? null));
}

/** The owner looking at the page, lower-cased (the send log's recipient); not-found for anyone else. */
async function viewingOwner(): Promise<string> {
  await requirePage("owner");
  const state = await getAuthState();
  return state.status === "ok" ? state.email.trim().toLowerCase() : "";
}

/**
 * What the daily run would send the owner looking at the page over the next COMING_UP_DAYS days, if
 * nothing changes; today's already-used channels are held back like the run does. Owners see every source.
 */
export async function getComingUp(): Promise<{ today: string; days: PreviewDay[]; failedSources: string[] }> {
  await connection();
  const recipient = await viewingOwner();
  const db = await readDb();
  const today = todayInAppTz();
  const [modes, log, { loaded, failedSources }] = await Promise.all([modesFrom(db), readLog(db, recipient), loadSources(reminderSources)]);
  const items = loaded.flatMap((l) => l.items);
  const days = previewUpcoming(items, today, usedKeysFrom(log, modes), COMING_UP_DAYS, channelsUsedOn(log, modes, today, appConfig.timeZone));
  return { today, days, failedSources };
}

/** The newest rows of the viewing owner's own send log. */
export async function listRecentNotifications(limit = 20) {
  await connection();
  const recipient = await viewingOwner();
  const db = await readDb();
  const now = new Date();
  const rows = await db
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
    .where(eq(notifications.recipient, recipient))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, shown: shownStatus(r, now) }));
}

export type RecentNotification = Awaited<ReturnType<typeof listRecentNotifications>>[number];
