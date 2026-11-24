import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { vapidFrom } from "./config";
import { base64UrlToBytes, deviceState, isAppleMobile, type BrowserFacts } from "./device-state";
import { pushPayload, sameOriginPath } from "./payload";

/** The small pure parts of iPhone push (N.3, C140): settings, payload, the page's states and the service worker. */

const PUBLIC = `B${"x".repeat(86)}`;
const PRIVATE = "y".repeat(43);

describe("vapidFrom", () => {
  it("is set up only when all three settings are present and well formed", () => {
    expect(vapidFrom({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: PUBLIC, VAPID_PRIVATE_KEY: PRIVATE, VAPID_SUBJECT: "https://hub.example.com" })).toEqual({
      publicKey: PUBLIC,
      privateKey: PRIVATE,
      subject: "https://hub.example.com",
    });
    expect(vapidFrom({})).toBeNull();
    expect(vapidFrom({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: PUBLIC, VAPID_PRIVATE_KEY: PRIVATE })).toBeNull();
    expect(vapidFrom({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: PUBLIC, VAPID_SUBJECT: "https://hub.example.com" })).toBeNull();
    expect(vapidFrom({ VAPID_PRIVATE_KEY: PRIVATE, VAPID_SUBJECT: "https://hub.example.com" })).toBeNull();
    expect(vapidFrom({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: "short", VAPID_PRIVATE_KEY: PRIVATE, VAPID_SUBJECT: "https://hub.example.com" })).toBeNull();
    expect(vapidFrom({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: PUBLIC, VAPID_PRIVATE_KEY: PRIVATE, VAPID_SUBJECT: "hub" })).toBeNull();
  });
});

describe("push payload", () => {
  it("carries title, body and a same-origin href only", () => {
    expect(JSON.parse(pushPayload({ title: "Insurance ends tomorrow", body: "Silver car", href: "/vehicles/v1?item=renewal:r1" }))).toEqual({
      title: "Insurance ends tomorrow",
      body: "Silver car",
      href: "/vehicles/v1?item=renewal:r1",
    });
  });

  it.each(["https://evil.com", "//evil.com/x", "/\\evil.com", "javascript:alert(1)", "vehicles", "/a b", "", `/${"a".repeat(600)}`])("turns %s into /", (href) => {
    expect(sameOriginPath(href)).toBe("/");
  });

  it("keeps it small", () => {
    const long = JSON.parse(pushPayload({ title: "t".repeat(500), body: "b".repeat(5000), href: "/" }));
    expect(long.title.length).toBeLessThanOrEqual(120);
    expect(long.body.length).toBeLessThanOrEqual(600);
  });
});

describe("This iPhone states", () => {
  const ready: BrowserFacts = {
    configured: true,
    isAppleMobile: true,
    standalone: true,
    hasServiceWorker: true,
    hasPushManager: true,
    hasNotification: true,
    permission: "default",
    subscribedHere: false,
  };

  it("picks the one state that says what can be done", () => {
    expect(deviceState({ ...ready, configured: false })).toBe("not-set-up");
    expect(deviceState({ ...ready, standalone: false, hasPushManager: false })).toBe("install-first");
    expect(deviceState({ ...ready, isAppleMobile: false, hasPushManager: false })).toBe("unsupported");
    expect(deviceState({ ...ready, permission: "denied" })).toBe("blocked");
    expect(deviceState(ready)).toBe("off");
    expect(deviceState({ ...ready, permission: "granted" })).toBe("off");
    expect(deviceState({ ...ready, permission: "granted", subscribedHere: true })).toBe("on");
  });

  it("knows an iPad that says it is a Mac", () => {
    expect(isAppleMobile("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", 5)).toBe(true);
    expect(isAppleMobile("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(true);
    expect(isAppleMobile("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe(false);
  });

  it("turns the base64url public key into its bytes", () => {
    expect([...base64UrlToBytes("AQID_-8")]).toEqual([1, 2, 3, 255, 239]);
  });
});

describe("service worker (public/sw.js)", () => {
  const source = readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");
  const listeners: Record<string, unknown> = {};
  const context = vm.createContext({
    URL,
    self: { location: { origin: "https://hub.example.com" }, addEventListener: (type: string, fn: unknown) => (listeners[type] = fn) },
  });
  vm.runInContext(source, context);
  const safePath = context.safePath as (href: unknown, origin: string) => string;

  it("only listens for push and taps (plus install and activate); no fetch handler, so it caches nothing", () => {
    expect(Object.keys(listeners).sort()).toEqual(["activate", "install", "notificationclick", "push"]);
    const code = source.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\bcaches\b|addEventListener\("fetch"|\bfetch\(/);
  });

  it("opens only paths on the hub; anything else falls back to /", () => {
    const origin = "https://hub.example.com";
    expect(safePath("/vehicles/v1?item=renewal:r1", origin)).toBe("/vehicles/v1?item=renewal:r1");
    // A push already sent before the two-tab page (V.3, C150) still opens: the old address is a path on the hub, and the page lands it on the Overview.
    expect(safePath("/vehicles/v1?tab=renewals", origin)).toBe("/vehicles/v1?tab=renewals");
    expect(safePath("/reminders#today", origin)).toBe("/reminders#today");
    for (const evil of ["https://evil.com/x", "//evil.com/x", "/\\evil.com", "\\\\evil.com", "javascript:alert(1)", "data:text/html,hi", "reminders", "/a b", "", null, 42, {}]) {
      expect(safePath(evil, origin), String(evil)).toBe("/");
    }
  });
});
