import { parse as legacyParse } from "node:url";
import { generateRequestDetails, sendNotification, WebPushError, type RequestOptions } from "web-push";
import { NotSentError } from "../channels";
import type { VapidConfig } from "./config";
import { PUSH_TIMEOUT_MS, PUSH_TTL_SECONDS } from "./payload";
import type { PushTransport } from "./sender";
import { isAllowedPushEndpoint } from "./subscription";

/**
 * The real way a push leaves the hub (Notifications N.3, DECISIONS C140): the `web-push` package
 * encrypts the payload for the device and POSTs it to the push service, signed with the VAPID key.
 * Act-now notices are `urgency: high` and live about 12 hours. Node's https does not follow redirects.
 *
 * Outcomes:
 *  - the push service's status code is returned (2xx, 404/410, other 4xx, 5xx);
 *  - anything web-push refuses BEFORE a request (a bad VAPID key, a device key that is not a P-256
 *    point, an endpoint whose host web-push would read differently) is a `NotSentError`: nothing went
 *    out, so the notice may be retried (at most three times);
 *  - only a timeout or a network error is thrown as an unknown outcome.
 *
 * A `WebPushError` carries the endpoint, the response headers and body: only its status code is kept,
 * never the error itself, so none of that can reach a log.
 */

/** The host web-push itself would contact for `endpoint` (it uses the legacy `url.parse`). */
export function hostWebPushWouldContact(endpoint: string): string | null {
  return legacyParse(endpoint).hostname ?? null;
}

export function webPushTransport(vapid: VapidConfig): PushTransport {
  const options: RequestOptions = {
    vapidDetails: { subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
    TTL: PUSH_TTL_SECONDS,
    urgency: "high",
    timeout: PUSH_TIMEOUT_MS,
  };
  return async (target, payload) => {
    // Everything web-push checks locally, without sending: a throw here means nothing went out.
    let endpoint: string;
    try {
      endpoint = generateRequestDetails(target, payload, options).endpoint;
    } catch {
      throw new NotSentError("The push could not be prepared for this device.");
    }
    // Last guard against the two URL parsers disagreeing: the host web-push will contact must be the checked one.
    if (!isAllowedPushEndpoint(endpoint) || hostWebPushWouldContact(endpoint) !== new URL(endpoint).hostname) {
      throw new NotSentError("The device's push address is not one the hub sends to.");
    }
    try {
      const res = await sendNotification(target, payload, options);
      return res.statusCode;
    } catch (err) {
      if (err instanceof WebPushError) return err.statusCode;
      // A timeout or network error: rethrow a bare error, not the original (it may name the host).
      throw new Error("The push service did not answer");
    }
  };
}
