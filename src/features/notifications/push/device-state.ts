/**
 * Which state Settings › Notifications › "This iPhone" is in (Notifications N.3, DECISIONS C140), from
 * what the browser can do. Pure, so every state can be tested and drawn without a phone.
 *
 *  - not-set-up:   the server has no VAPID keys, so nothing can be turned on;
 *  - install-first: iPhone or iPad Safari in a tab: web push only works once the hub is added to the
 *                   Home Screen and opened from there (iOS 16.4+);
 *  - unsupported:  no service worker, push or notifications in this browser;
 *  - blocked:      notifications were refused for the hub (only the device's settings can undo it);
 *  - off:          can be turned on (asking permission happens only from a tap);
 *  - on:           this browser's subscription is saved for the signed-in owner.
 */
export type DeviceState = "not-set-up" | "install-first" | "unsupported" | "blocked" | "off" | "on";

export type BrowserFacts = {
  configured: boolean;
  isAppleMobile: boolean;
  standalone: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  permission: "default" | "granted" | "denied";
  /** This browser has a push subscription AND the server lists it for the signed-in owner. */
  subscribedHere: boolean;
};

export function deviceState(f: BrowserFacts): DeviceState {
  if (!f.configured) return "not-set-up";
  if (f.isAppleMobile && !f.standalone) return "install-first";
  if (!f.hasServiceWorker || !f.hasPushManager || !f.hasNotification) return "unsupported";
  if (f.permission === "denied") return "blocked";
  return f.subscribedHere && f.permission === "granted" ? "on" : "off";
}

/** iPhone, iPod or iPad (iPadOS says it is a Mac, but has a touch screen). */
export function isAppleMobile(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** The VAPID public key (base64url) as the bytes `pushManager.subscribe` wants. */
export function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
