/**
 * Checking a browser push subscription before the hub stores it or sends to it (Notifications N.3,
 * DECISIONS C140). Pure.
 *
 * The server later POSTs to the subscription's endpoint (web-push), so an endpoint the browser did not
 * get from a real push service would let anyone who can call the Server Action make the server send
 * requests wherever they like (server-side request forgery). So the endpoint must be `https:` on the
 * default port, with no user name or password, on one of the known push services' hosts, and the
 * check is made when the subscription is saved AND again before every send.
 */

/**
 * Exact hosts of the push services: Apple's documented Safari / iPhone host, Google's FCM and Mozilla's
 * autopush. Not the legacy GCM host (android.googleapis.com): it never works with VAPID. Not every
 * `*.googleapis.com`: that would include Google Cloud Storage, where anyone can host a URL.
 */
const EXACT_HOSTS = new Set(["web.push.apple.com", "fcm.googleapis.com", "updates.push.services.mozilla.com"]);

/**
 * One extra label in front of these: Apple asks servers that check endpoints to allow `*.push.apple.com`
 * (WebKit, "Meet Web Push for Safari"), and Windows (Edge) uses `wns2-<region>.notify.windows.com`.
 */
const ONE_LABEL_UNDER = [".push.apple.com", ".notify.windows.com"];

const MAX_ENDPOINT = 1024;

/**
 * True when `endpoint` is an https address on one of the real push services, written in its one
 * canonical form.
 *
 * Canonical matters: web-push 3.x sends with Node's legacy `url.parse()`, which reads some strings
 * differently from the WHATWG `URL` parser used here (`https://evil.com%2eweb.push.apple.com/x`,
 * `https:/fcm.googleapis.com/x`, a backslash, a tab or a soft hyphen in the host). So the endpoint is only
 * accepted when `new URL(endpoint).href` is exactly the same string AND it starts with
 * `https://<hostname>/`: then there is nothing for the two parsers to disagree about (no user info, no
 * port, no escapes or stray characters in the host), and the string that is stored and sent is that one.
 */
export function isAllowedPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length === 0 || endpoint.length > MAX_ENDPOINT) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.href !== endpoint || url.protocol !== "https:") return false;
  const host = url.hostname;
  if (!endpoint.startsWith(`https://${host}/`)) return false;
  // Plain ASCII names only (an IP address never matches the names below).
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return false;
  if (EXACT_HOSTS.has(host)) return true;
  // Exactly one DNS label (at most 63 characters, no leading or trailing hyphen) in front of the suffix.
  return ONE_LABEL_UNDER.some((suffix) => host.endsWith(suffix) && /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(host.slice(0, -suffix.length)));
}

/** base64url (no padding after we strip it): letters, digits, `-` and `_` only. */
const BASE64URL = /^[A-Za-z0-9_-]+$/;

/**
 * A P-256 public key is 65 bytes (87 base64url characters); the auth secret is 16 bytes (22). A small
 * margin either side, matching the table's check constraints.
 */
const P256DH_LENGTH = { min: 80, max: 100 };
const AUTH_LENGTH = { min: 16, max: 32 };

export type CleanSubscription = { endpoint: string; p256dh: string; auth: string };
export type SubscriptionCheck = { ok: true; value: CleanSubscription } | { ok: false; error: string };

function key(value: unknown, length: { min: number; max: number }): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/=+$/, "");
  return BASE64URL.test(clean) && clean.length >= length.min && clean.length <= length.max ? clean : null;
}

/**
 * Checks what `PushSubscription.toJSON()` gave the browser: `{ endpoint, expirationTime?, keys: { p256dh, auth } }`.
 * Anything else (a missing key, extra fields of the wrong type, a strange endpoint) is refused.
 */
export function parseSubscription(input: unknown): SubscriptionCheck {
  const refuse = (error: string): SubscriptionCheck => ({ ok: false, error });
  if (!input || typeof input !== "object" || Array.isArray(input)) return refuse("That is not a push subscription.");
  const obj = input as Record<string, unknown>;
  const allowed = new Set(["endpoint", "expirationTime", "keys"]);
  if (Object.keys(obj).some((k) => !allowed.has(k))) return refuse("That is not a push subscription.");
  if (obj.expirationTime !== undefined && obj.expirationTime !== null && typeof obj.expirationTime !== "number") return refuse("That is not a push subscription.");
  if (!isAllowedPushEndpoint(obj.endpoint)) return refuse("This browser's push service is not one the hub sends to.");
  const keys = obj.keys;
  if (!keys || typeof keys !== "object" || Array.isArray(keys)) return refuse("The push subscription has no keys.");
  const k = keys as Record<string, unknown>;
  if (Object.keys(k).some((name) => name !== "p256dh" && name !== "auth")) return refuse("The push subscription's keys look wrong.");
  const p256dh = key(k.p256dh, P256DH_LENGTH);
  const auth = key(k.auth, AUTH_LENGTH);
  if (!p256dh || !auth) return refuse("The push subscription's keys look wrong.");
  return { ok: true, value: { endpoint: obj.endpoint, p256dh, auth } };
}

/** The device's name in the list, from the browser's user agent: never typed, never more than a word. */
export function deviceLabelFrom(userAgent: string, maxTouchPoints = 0): string {
  if (/iPhone|iPod/.test(userAgent)) return "iPhone";
  // iPadOS reports itself as a Mac; a touch screen gives it away.
  if (/iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return "iPad";
  if (/Android/.test(userAgent)) return "Android";
  if (/Macintosh/.test(userAgent)) return "Mac";
  if (/Windows/.test(userAgent)) return "Windows";
  return "Browser";
}

const LABELS = new Set(["iPhone", "iPad", "Android", "Mac", "Windows", "Browser"]);

/** The label the server stores: one of the known words, anything else "Browser". */
export function cleanDeviceLabel(label: unknown): string {
  return typeof label === "string" && LABELS.has(label) ? label : "Browser";
}
