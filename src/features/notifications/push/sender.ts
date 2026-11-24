import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db/read";
import { pushSubscriptions } from "@/db/schema";
import { safeErrorSummary } from "@/lib/errors";
import { NotSentError, type ChannelSender } from "../channels";
import type { Message } from "../planner";
import { deliverGoneNotices } from "./gone";
import { pushPayload } from "./payload";
import { isAllowedPushEndpoint } from "./subscription";

/**
 * The iPhone push sender (Notifications N.3, DECISIONS C140), implementing N.1's channel interface.
 * Sends one batched message to every device the recipient turned pushes on for (or, for a test push,
 * to the one device that asked). Takes the database as a handle (the run passes the real one, Server
 * Actions theirs, tests an in-memory one).
 *
 * Per device, by the push service's answer:
 *  - 2xx: delivered; its `last_ok_at` is stamped;
 *  - 404 or 410: the subscription is gone for good: it is marked `gone_at` (never sent to again) and
 *    ONE "stopped accepting pushes" email notice is logged through the send log (push/gone.ts);
 *  - any other 4xx, or web-push refusing it before sending (a `NotSentError` from the transport): refused;
 *  - 5xx, a timeout or a network error: unknown (it may have arrived).
 * The message counts as sent when at least one device took it. Otherwise: any unknown device makes the
 * outcome unknown (a plain error: the rows stay pending and are never sent again, per N.1); all refused
 * means `NotSentError` (the rows become `failed` and may be retried while timely, at most three times).
 *
 * Nothing about a device reaches a log: no endpoint, no key, no payload; errors as name and code only.
 */

export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } };
/**
 * Sends one encrypted push and answers the push service's HTTP status. Throws `NotSentError` when it
 * knows nothing went out, anything else when the outcome is unknown.
 */
export type PushTransport = (target: PushTarget, payload: string) => Promise<number>;

export type GoneDevice = { recipient: string; subscriptionId: string; deviceLabel: string };

export type PushSenderDeps = {
  db: Db;
  /** Null when the VAPID keys are missing: the channel is then not set up and stays a dry run. */
  transport: PushTransport | null;
  /** The email sender of the same run (N.2's when built): it carries the "stopped accepting pushes" notice. */
  emailSender: Pick<ChannelSender, "implemented" | "send">;
  /** Only the device whose endpoint hashes to this (SHA-256, hex): a test push goes to the device that asked. */
  onlyEndpointHash?: string;
  now?: () => Date;
  /**
   * Whether this recipient may be emailed (default: everyone). Only the owners may (N.5, C144): for anyone
   * else a gone device is just marked, and their own page shows "Stopped accepting pushes"; no email is
   * written or sent about it.
   */
  canEmail?: (recipient: string) => boolean;
  /** Called once for each subscription this sender marked gone. Default: log its email notice (held if an email already went today). */
  onGone?: (device: GoneDevice) => Promise<unknown>;
};

export type DeviceOutcome = "delivered" | "gone" | "refused" | "unknown";

export const endpointHash = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex");

export function createPushSender({ db, transport, emailSender, onlyEndpointHash, now = () => new Date(), canEmail = () => true, onGone }: PushSenderDeps): ChannelSender {
  const notifyGone = onGone ?? ((d: GoneDevice) => deliverGoneNotices(db, { recipient: d.recipient, now: now(), emailSender }));

  async function toDevice(sub: typeof pushSubscriptions.$inferSelect, payload: string): Promise<DeviceOutcome> {
    // Checked again before every send (the same canonical rule): a row holding another address is never contacted.
    if (!isAllowedPushEndpoint(sub.endpoint) || !transport) return "refused";
    let status: number;
    try {
      status = await transport({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
    } catch (err) {
      if (err instanceof NotSentError) return "refused";
      console.error(`Push to one device: outcome unknown: ${safeErrorSummary(err)}`);
      return "unknown";
    }
    if (status >= 200 && status < 300) {
      await db.update(pushSubscriptions).set({ lastOkAt: now() }).where(eq(pushSubscriptions.id, sub.id));
      return "delivered";
    }
    if (status === 404 || status === 410) {
      // Only the send that actually marked the row writes the notice, so two sends at once cannot both.
      const marked = await db
        .update(pushSubscriptions)
        .set({ goneAt: now() })
        .where(and(eq(pushSubscriptions.id, sub.id), isNull(pushSubscriptions.goneAt)))
        .returning({ id: pushSubscriptions.id });
      if (marked.length > 0 && canEmail(sub.recipient)) {
        try {
          await notifyGone({ recipient: sub.recipient, subscriptionId: sub.id, deviceLabel: sub.deviceLabel });
        } catch (err) {
          // The row stays marked gone, so the next daily run logs the notice instead.
          console.error(`Could not log that a device stopped accepting pushes: ${safeErrorSummary(err)}`);
        }
      }
      return "gone";
    }
    if (status >= 400 && status < 500) return "refused";
    return "unknown";
  }

  return {
    channel: "push",
    implemented: transport !== null,
    async send(message: Message) {
      if (!transport) throw new NotSentError("iPhone push is not set up (the VAPID keys are missing).");
      const all = await db
        .select()
        .from(pushSubscriptions)
        .where(and(eq(pushSubscriptions.recipient, message.recipient), isNull(pushSubscriptions.goneAt)));
      const subs = onlyEndpointHash === undefined ? all : all.filter((s) => endpointHash(s.endpoint) === onlyEndpointHash);
      if (subs.length === 0) throw new NotSentError(onlyEndpointHash === undefined ? "No device has pushes turned on." : "Pushes are not on for this device.");
      const payload = pushPayload(message);
      const outcomes: DeviceOutcome[] = [];
      for (const sub of subs) outcomes.push(await toDevice(sub, payload));
      if (outcomes.includes("delivered")) return;
      const unknown = outcomes.filter((o) => o === "unknown").length;
      if (unknown > 0) throw new Error(`The push service did not confirm it (${unknown} of ${outcomes.length} devices).`);
      throw new NotSentError(outcomes.every((o) => o === "gone") ? "The device stopped accepting pushes and was removed." : "The push service refused the message.");
    },
  };
}
