"use server";

import { and, count, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { appConfig } from "@/config/app.config";
import { db } from "@/db";
import { notifications, pushSubscriptions } from "@/db/schema";
import type { ActionState } from "@/features/shared/types";
import { ValidationError } from "@/features/shared/validation";
import { requireUser } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { safeErrorSummary } from "@/lib/errors";
import { sendLive, TEST_KIND } from "./log";
import { vapidFromEnv } from "./push/config";
import { endpointHash } from "./push/sender";
import { cleanDeviceLabel, parseSubscription } from "./push/subscription";
import { buildSenders } from "./senders";
import { saveSwitch } from "./switches";
import { systemMessage } from "./system";

/**
 * iPhone push (Notifications N.3, DECISIONS C140; for shared people N.5, C144): turning it on for a
 * device, off again, removing one, a test push, and (owners only) the switch that makes the daily run's
 * pushes real. Server Actions are public HTTP endpoints, so every input is checked here.
 *
 * The four device actions are for ANY signed-in, allowed person (an owner, or an active person):
 * `requireUser("signed-in")` refuses signed-out visitors, people waiting for approval (they see the
 * demo), blocked people and everyone else, because only an `ok` state passes. The recipient is always
 * the caller's own verified email from that check, never anything the client sends; a device is bound
 * to it, and a person can only list, remove or test their own. `setPushLive` stays owner-only. Nothing
 * about a device is ever logged.
 */

/** At most this many devices per person (a phone, a tablet, a computer or two). */
const MAX_DEVICES = 10;
/** One test push per clock minute per person. */
const TEST_EVERY_MS = 60_000;

const NOT_SET_UP = "iPhone push is not set up on the server yet (the VAPID keys are missing).";

/** Like toActionState, but a failed query is logged as its name and code only (it may carry an endpoint or keys). */
function failed(err: unknown): ActionState {
  if (err instanceof ValidationError) return { ok: false, error: err.message };
  console.error(`Push action failed: ${safeErrorSummary(err)}`);
  return { ok: false, error: "Something went wrong. Please try again." };
}

const lower = (email: string) => email.trim().toLowerCase();

/** Saves this browser's push subscription for the signed-in person (upsert by endpoint). */
export async function subscribePush(subscription: unknown, label: unknown): Promise<ActionState> {
  try {
    const { email } = await requireUser("signed-in");
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

    // Upsert by endpoint, but never move a device that belongs to another account: the update only applies
    // to the caller's own row, and nothing comes back otherwise. A resubscribe also clears `gone_at`.
    const saved = await db
      .insert(pushSubscriptions)
      .values({ recipient, endpoint: parsed.value.endpoint, p256dh: parsed.value.p256dh, auth: parsed.value.auth, deviceLabel })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { p256dh: parsed.value.p256dh, auth: parsed.value.auth, deviceLabel, goneAt: null },
        setWhere: eq(pushSubscriptions.recipient, recipient),
      })
      .returning({ id: pushSubscriptions.id });
    if (saved.length === 0) throw new ValidationError("Pushes on this device belong to another account. Turn them off there first.");
    refresh();
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}

/** Turns pushes off for this browser: deletes its subscription, only if it is the caller's own. */
export async function unsubscribePush(endpoint: unknown): Promise<ActionState> {
  try {
    const { email } = await requireUser("signed-in");
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
    const { email } = await requireUser("signed-in");
    if (typeof id !== "string" || !UUID.test(id)) throw new ValidationError("That device is not in the list.");
    await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.id, id), eq(pushSubscriptions.recipient, lower(email))));
    refresh();
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}

/**
 * Sends "Test from the hub" now, to the ONE device that asked (its endpoint's SHA-256, which the page
 * works out in the browser), and only if that device is the caller's own. It skips the planner (it is
 * not a notice about anything) and is logged with that device's outcome (kind "push-test", left out of
 * the planning, so it never uses up the day's push). At most one per clock minute, enforced by the
 * database: the dedupe key is the minute, and the log's unique index refuses a second pending or sent
 * row for it, so two taps at once cannot both send; a test refused that minute blocks it too.
 */
export async function sendTestPush(thisEndpointHash: unknown): Promise<ActionState> {
  try {
    const { email, access } = await requireUser("signed-in");
    if (!vapidFromEnv()) throw new ValidationError(NOT_SET_UP);
    if (typeof thisEndpointHash !== "string" || !/^[0-9a-f]{64}$/.test(thisEndpointHash)) throw new ValidationError("Turn pushes on for this device first.");
    const recipient = lower(email);
    const now = new Date();
    const minute = Math.floor(now.getTime() / TEST_EVERY_MS);
    const dedupeKey = `${TEST_KIND}:${minute}`;
    const tooSoon = new ValidationError("One test a minute. Try again shortly.");

    const mine = await db
      .select({ endpoint: pushSubscriptions.endpoint })
      .from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.recipient, recipient), isNull(pushSubscriptions.goneAt)));
    if (!mine.some((s) => endpointHash(s.endpoint) === thisEndpointHash)) throw new ValidationError("Pushes are not on for this device. Turn them on first.");

    const [already] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.recipient, recipient), eq(notifications.dedupeKey, dedupeKey)))
      .limit(1);
    if (already) throw tooSoon;

    const message = systemMessage({
      recipient,
      channel: "push",
      kind: TEST_KIND,
      dedupeKey,
      title: `Test from the ${appConfig.name}`,
      body: "Pushes reach this device.",
      // Settings is the owners'; a shared person's page is /notifications (N.5, C144).
      href: access.owner ? "/settings/notifications" : "/notifications",
      today: todayIn(appConfig.timeZone, now),
    });
    const result = await sendLive(db, message, buildSenders(db, { onlyEndpointHash: thisEndpointHash }).push);
    refresh();
    if (result.written === 0) throw tooSoon;
    if (result.sent > 0) return { ok: true };
    if (result.failed > 0) return { ok: false, error: "This device did not take it. Turn pushes off here and on again." };
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
    // Merged in one statement, so the email switch (N.2) is never overwritten (switches.ts).
    await saveSwitch(db, "push", enabled);
    refresh();
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}
