import "server-only";
import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { cache } from "react";
import { safeErrorSummary } from "@/lib/errors";
import { appConfig } from "@/config/app.config";
import { readDb, type Db } from "@/db/read";
import { appSettings, notifications, pushSubscriptions } from "@/db/schema";
import { loadSources, noticeSources, reminderSources } from "@/features/reminders/sources";
import { getAuthState, requirePage } from "@/lib/auth";
import { todayInAppTz } from "@/lib/format";
import { channelModes, NOTIFICATIONS_SETTINGS_KEY, parseSwitches, SENDERS, type ChannelModes, type NotificationSwitches } from "./channels";
import { vapidFromEnv } from "./push/config";
import { channelsUsedOn, readLog, shownStatus, usedKeysFrom } from "./log";
import { previewUpcoming, type PreviewDay } from "./planner";

/**
 * Settings › Notifications (owner only, N.1): what would go out next, and the send log. Each query
 * checks the owner itself, not only the Settings layout: a partial page request can skip the layout,
 * and `readDb()` alone would hand a signed-in person the real database.
 */

/** How far ahead "Coming up" looks. */
export const COMING_UP_DAYS = 30;

async function switchesFrom(db: Db): Promise<NotificationSwitches> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, NOTIFICATIONS_SETTINGS_KEY));
  return parseSwitches(row?.value ?? null);
}

/** Each channel's mode as the daily run would see it: push counts as built only when the VAPID keys are set (C140). */
async function modesFrom(db: Db): Promise<ChannelModes> {
  return channelModes(await switchesFrom(db), { email: SENDERS.email, push: { implemented: vapidFromEnv() !== null } });
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
  const [modes, log, dated, happening] = await Promise.all([modesFrom(db), readLog(db, recipient), loadSources(reminderSources), loadSources(noticeSources)]);
  const items = dated.loaded.flatMap((l) => l.items);
  // Events happening now (a slab limit, a reading overdue, a sign-up request, N.4): the owner sees all of them.
  const events = happening.loaded.flatMap((l) => l.items);
  const days = previewUpcoming(items, today, usedKeysFrom(log, modes), COMING_UP_DAYS, channelsUsedOn(log, modes, today, appConfig.timeZone), events);
  return { today, days, failedSources: [...dated.failedSources, ...happening.failedSources] };
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

export type PushDevice = {
  id: string;
  label: string;
  createdAt: Date;
  lastOkAt: Date | null;
  /** The push service said it is gone (404/410): nothing is sent to it; it is removed once its email notice is logged. */
  gone: boolean;
  /**
   * SHA-256 of the endpoint, so the page can tell which row is the browser it runs in (the browser
   * hashes its own endpoint) without the endpoint itself ever leaving the server.
   */
  endpointHash: string;
};

export type PushSetup = {
  /** The VAPID keys are set on the server. */
  configured: boolean;
  /** The public key the browser subscribes with (public by design); null when not configured. */
  publicKey: string | null;
  /** The owner's "make pushes real" switch (app_settings › notifications › push). */
  switchedOn: boolean;
  devices: PushDevice[];
};

/**
 * Settings › Notifications › This iPhone (N.3, C140): the viewing owner's own devices and the push
 * switch. If the `push_subscriptions` table is not there yet (the code deployed before migration 0017),
 * push shows as not set up instead of breaking the page. Use `getPushSetup` (memoised per request).
 */
export async function loadPushSetup(): Promise<PushSetup> {
  await connection();
  const recipient = await viewingOwner();
  const db = await readDb();
  const vapid = vapidFromEnv();
  const switches = await switchesFrom(db);
  let rows: { id: string; label: string; endpoint: string; createdAt: Date; lastOkAt: Date | null; goneAt: Date | null }[];
  try {
    rows = await db
      .select({
        id: pushSubscriptions.id,
        label: pushSubscriptions.deviceLabel,
        endpoint: pushSubscriptions.endpoint,
        createdAt: pushSubscriptions.createdAt,
        lastOkAt: pushSubscriptions.lastOkAt,
        goneAt: pushSubscriptions.goneAt,
      })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.recipient, recipient))
      .orderBy(desc(pushSubscriptions.createdAt));
  } catch (err) {
    console.error(`Could not read push devices (is migration 0017/0018 applied?): ${safeErrorSummary(err)}`);
    return { configured: false, publicKey: null, switchedOn: switches.push.enabled, devices: [] };
  }
  return {
    configured: vapid !== null,
    publicKey: vapid?.publicKey ?? null,
    switchedOn: switches.push.enabled,
    devices: rows.map(({ endpoint, goneAt, ...r }) => ({ ...r, gone: goneAt !== null, endpointHash: createHash("sha256").update(endpoint).digest("hex") })),
  };
}

export const getPushSetup = cache(loadPushSetup);
