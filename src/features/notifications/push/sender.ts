import { eq } from "drizzle-orm";
import type { Db } from "@/db/read";
import { pushSubscriptions } from "@/db/schema";
import { safeErrorSummary } from "@/lib/errors";
import { NotSentError, SENDERS, type ChannelSender } from "../channels";
import type { Message } from "../planner";
import { recordPushGone } from "./gone";
import { pushPayload } from "./payload";
import { isAllowedPushEndpoint } from "./subscription";

/**
 * The iPhone push sender (Notifications N.3, DECISIONS C140), implementing N.1's channel interface.
 * Sends one batched message to every device the recipient turned pushes on for. Takes the database as a
 * handle (the run passes the real one, Server Actions theirs, tests an in-memory one).
 *
 * Per device, by the push service's answer:
 *  - 2xx: delivered; its `last_ok_at` is stamped;
 *  - 404 or 410: the subscription is gone for good: it is deleted and ONE "stopped accepting pushes"
 *    email notice is written through the send log (src/features/notifications/push/gone.ts);
 *  - any other 4xx: refused (nothing went out);
 *  - 5xx, a timeout or a network error: unknown (it may have arrived).
 * The message counts as sent when at least one device took it. Otherwise: any unknown device makes the
 * outcome unknown (a plain error: the rows stay pending and are never sent again, per N.1); all refused
 * means `NotSentError` (the rows become `failed` and may be retried while timely, at most three times).
 *
 * Nothing about a device reaches a log: no endpoint, no key, no payload; errors as name and code only.
 */

export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } };
/** Sends one encrypted push and answers the push service's HTTP status; throws when the outcome is unknown. */
export type PushTransport = (target: PushTarget, payload: string) => Promise<number>;

export type GoneDevice = { recipient: string; subscriptionId: string; deviceLabel: string };

export type PushSenderDeps = {
  db: Db;
  /** Null when the VAPID keys are missing: the channel is then not set up and stays a dry run. */
  transport: PushTransport | null;
  now?: () => Date;
  /** Called once for each subscription this sender deleted as gone. Default: the email notice. */
  onGone?: (device: GoneDevice) => Promise<unknown>;
};

export type DeviceOutcome = "delivered" | "gone" | "refused" | "unknown";

export function createPushSender({ db, transport, now = () => new Date(), onGone }: PushSenderDeps): ChannelSender {
  const notifyGone =
    onGone ?? ((d: GoneDevice) => recordPushGone(db, { recipient: d.recipient, subscriptionId: d.subscriptionId, deviceLabel: d.deviceLabel, now: now(), emailSender: SENDERS.email }));

  async function toDevice(sub: typeof pushSubscriptions.$inferSelect, payload: string): Promise<DeviceOutcome> {
    // Checked again before every send: a row that somehow holds another address is never contacted.
    if (!isAllowedPushEndpoint(sub.endpoint) || !transport) return "refused";
    let status: number;
    try {
      status = await transport({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
    } catch (err) {
      console.error(`Push to one device: outcome unknown: ${safeErrorSummary(err)}`);
      return "unknown";
    }
    if (status >= 200 && status < 300) {
      await db.update(pushSubscriptions).set({ lastOkAt: now() }).where(eq(pushSubscriptions.id, sub.id));
      return "delivered";
    }
    if (status === 404 || status === 410) {
      // Only the send that actually deleted the row writes the notice, so two sends at once cannot both.
      const deleted = await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id)).returning({ id: pushSubscriptions.id });
      if (deleted.length > 0) {
        try {
          await notifyGone({ recipient: sub.recipient, subscriptionId: sub.id, deviceLabel: sub.deviceLabel });
        } catch (err) {
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
      const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.recipient, message.recipient));
      if (subs.length === 0) throw new NotSentError("No device has pushes turned on.");
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
