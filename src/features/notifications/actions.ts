"use server";

import { and, count, desc, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { appConfig } from "@/config/app.config";
import { db } from "@/db";
import { appSettings, notifications, pushSubscriptions } from "@/db/schema";
import type { ActionState } from "@/features/shared/types";
import { ValidationError } from "@/features/shared/validation";
import { requireUser } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { safeErrorSummary } from "@/lib/errors";
import { NOTIFICATIONS_SETTINGS_KEY, parseSwitches } from "./channels";
import { sendLive, TEST_KIND } from "./log";
import { vapidFromEnv } from "./push/config";
import { createPushSender } from "./push/sender";
import { cleanDeviceLabel, parseSubscription } from "./push/subscription";
import { webPushTransport } from "./push/transport";
import { systemMessage } from "./system";

/**
 * iPhone push (Notifications N.3, DECISIONS C140): turning it on for a device, off again, a test push
 * and the switch that makes the daily run's pushes real. Owners only for now. Server Actions are public
 * HTTP endpoints, so every input is checked here; a device is always bound to the signed-in owner, and
 * an owner can only remove or test their own devices. Nothing about a device is ever logged.
 */

/** At most this many devices per owner (a phone, a tablet, a computer or two). */
const MAX_DEVICES = 10;
/** One test push a minute per owner. */
const TEST_EVERY_MS = 60_000;

const NOT_SET_UP = "iPhone push is not set up on the server yet (the VAPID keys are missing).";

/** Like toActionState, but a failed query is logged as its name and code only (it may carry an endpoint or keys). */
function failed(err: unknown): ActionState {
  if (err instanceof ValidationError) return { ok: false, error: err.message };
  console.error(`Push action failed: ${safeErrorSummary(err)}`);
  return { ok: false, error: "Something went wrong. Please try again." };
}

const lower = (email: string) => email.trim().toLowerCase();

/** Saves this browser's push subscription for the signed-in owner (upsert by endpoint). */
export async function subscribePush(subscription: unknown, label: unknown): Promise<ActionState> {
  try {
    const { email } = await requireUser("owner");
    if (!vapidFromEnv()) throw new ValidationError(NOT_SET_UP);
    const parsed = parseSubscription(subscription);
    if (!parsed.ok) throw new ValidationError(parsed.error);
    const recipient = lower(email);
    const deviceLabel = cleanDeviceLabel(label);

    const [mine] = await db.select({ n: count() }).from(pushSubscriptions).where(eq(pushSubscriptions.recipient, recipient));
    const [existing] = await db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.endpoint, parsed.value.endpoint), eq(pushSubscriptions.recipient, recipient)));
    if (!existing && (mine?.n ?? 0) >= MAX_DEVICES) throw new ValidationError(`Pushes are on for ${MAX_DEVICES} devices already. Remove one first.`);

    const values = { recipient, p256dh: parsed.value.p256dh, auth: parsed.value.auth, deviceLabel };
    await db
      .insert(pushSubscriptions)
      .values({ ...values, endpoint: parsed.value.endpoint })
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values });
    refresh();
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}

/** Turns pushes off for this browser: deletes its subscription, only if it is the caller's own. */
export async function unsubscribePush(endpoint: unknown): Promise<ActionState> {
  try {
    const { email } = await requireUser("owner");
    if (typeof endpoint !== "string" || endpoint.length === 0 || endpoint.length > 1024) throw new ValidationError("That is not a push subscription.");
    await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.recipient, lower(email))));
    refresh();
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Removes one of the caller's own devices from the list. */
export async function removePushDevice(id: unknown): Promise<ActionState> {
  try {
    const { email } = await requireUser("owner");
    if (typeof id !== "string" || !UUID.test(id)) throw new ValidationError("That device is not in the list.");
    await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.id, id), eq(pushSubscriptions.recipient, lower(email))));
    refresh();
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}

/**
 * Sends "Test from the hub" to the caller's own devices, now. It skips the planner (it is not a notice
 * about anything) and is logged with its outcome (kind "push-test", left out of the planning, so it
 * never uses up the day's push). One a minute: the last test's time is checked, and the dedupe key holds
 * the minute, so two taps at once cannot both claim it.
 */
export async function sendTestPush(): Promise<ActionState> {
  try {
    const { email } = await requireUser("owner");
    const vapid = vapidFromEnv();
    if (!vapid) throw new ValidationError(NOT_SET_UP);
    const recipient = lower(email);
    const now = new Date();
    const tooSoon = new ValidationError("One test a minute. Try again shortly.");

    const [last] = await db
      .select({ createdAt: notifications.createdAt })
      .from(notifications)
      .where(and(eq(notifications.recipient, recipient), eq(notifications.kind, TEST_KIND)))
      .orderBy(desc(notifications.createdAt))
      .limit(1);
    if (last && now.getTime() - last.createdAt.getTime() < TEST_EVERY_MS) throw tooSoon;

    const message = systemMessage({
      recipient,
      channel: "push",
      kind: TEST_KIND,
      dedupeKey: `${TEST_KIND}:${now.toISOString().slice(0, 16)}`,
      title: `Test from the ${appConfig.name}`,
      body: "Pushes reach this device.",
      href: "/settings/notifications",
      today: todayIn(appConfig.timeZone, now),
    });
    const sender = createPushSender({ db, transport: webPushTransport(vapid) });
    const result = await sendLive(db, message, sender);
    refresh();
    if (result.written === 0) throw tooSoon;
    if (result.sent > 0) return { ok: true };
    if (result.failed > 0) return { ok: false, error: "The push service refused it. Turn pushes off and on again on the device." };
    return { ok: false, error: "Sent, but the push service did not confirm it. Wait a minute before trying again." };
  } catch (err) {
    return failed(err);
  }
}

/**
 * The switch that makes the daily run's pushes real (default off). Live only when this is on AND the
 * VAPID keys are set; it cannot be turned on without them.
 */
export async function setPushLive(enabled: unknown): Promise<ActionState> {
  try {
    await requireUser("owner");
    if (typeof enabled !== "boolean") throw new ValidationError("Choose on or off.");
    if (enabled && !vapidFromEnv()) throw new ValidationError(NOT_SET_UP);
    const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, NOTIFICATIONS_SETTINGS_KEY));
    const switches = parseSwitches(row?.value ?? null);
    const value = { ...switches, push: { enabled } };
    await db
      .insert(appSettings)
      .values({ key: NOTIFICATIONS_SETTINGS_KEY, value })
      .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
    refresh();
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}
