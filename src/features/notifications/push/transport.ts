import { sendNotification, WebPushError } from "web-push";
import type { VapidConfig } from "./config";
import { PUSH_TIMEOUT_MS, PUSH_TTL_SECONDS } from "./payload";
import type { PushTransport } from "./sender";

/**
 * The real way a push leaves the hub (Notifications N.3, DECISIONS C140): the `web-push` package
 * encrypts the payload for the device and POSTs it to the push service, signed with the VAPID key.
 * Act-now notices are `urgency: high` and live about 12 hours. Answers the push service's status code;
 * a timeout or a network error is thrown (an unknown outcome). Node's https does not follow redirects.
 *
 * A `WebPushError` carries the endpoint, the response headers and body: only its status code is kept,
 * never the error itself, so none of that can reach a log.
 */
export function webPushTransport(vapid: VapidConfig): PushTransport {
  return async (target, payload) => {
    try {
      const res = await sendNotification(target, payload, {
        vapidDetails: { subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
        TTL: PUSH_TTL_SECONDS,
        urgency: "high",
        timeout: PUSH_TIMEOUT_MS,
      });
      return res.statusCode;
    } catch (err) {
      if (err instanceof WebPushError) return err.statusCode;
      // A timeout or network error: rethrow a bare error, not the original (it may name the host).
      throw new Error("The push service did not answer");
    }
  };
}
