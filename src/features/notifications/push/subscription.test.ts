import { describe, expect, it } from "vitest";
import { cleanDeviceLabel, deviceLabelFrom, isAllowedPushEndpoint, parseSubscription } from "./subscription";

/** Made-up keys of the right shape: a 65-byte public key (87 characters) and a 16-byte secret (22). */
const P256DH = `B${"A".repeat(86)}`;
const AUTH = "abcdefghijklmnopqrstuv";
const sub = (endpoint: unknown, keys: unknown = { p256dh: P256DH, auth: AUTH }) => ({ endpoint, expirationTime: null, keys });

describe("push endpoint allowlist (no server-side request forgery)", () => {
  it.each([
    "https://web.push.apple.com/QGf0abc",
    "https://api.push.apple.com/3/device/xyz",
    "https://fcm.googleapis.com/fcm/send/abc:def",
    "https://android.googleapis.com/gcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAA",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
  ])("allows %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    ["plain http", "http://web.push.apple.com/abc"],
    ["localhost", "https://localhost/abc"],
    ["localhost with a port", "https://localhost:3000/abc"],
    ["the cloud metadata address", "https://169.254.169.254/latest/meta-data/"],
    ["the metadata address over http", "http://169.254.169.254/latest/meta-data/"],
    ["a private address", "https://10.0.0.1/push"],
    ["an IPv6 loopback", "https://[::1]/push"],
    ["another site", "https://evil.com/push"],
    ["a look-alike that ends in another domain", "https://apple.com.evil.com/push"],
    ["a look-alike that ends in another domain (push host)", "https://web.push.apple.com.evil.com/push"],
    ["a name glued onto the suffix", "https://evilpush.apple.com/push"],
    ["a bare suffix", "https://push.apple.com/push"],
    ["a user name in front", "https://web.push.apple.com@evil.com/push"],
    ["credentials", "https://user:pass@web.push.apple.com/push"],
    ["a non-default port", "https://web.push.apple.com:8443/push"],
    ["a trailing dot", "https://fcm.googleapis.com./push"],
    ["javascript", "javascript:alert(1)"],
    ["a data URL", "data:text/plain,hi"],
    ["a relative path", "/api/notify"],
    ["an empty string", ""],
    ["a very long address", `https://web.push.apple.com/${"a".repeat(1100)}`],
  ])("refuses %s", (_why, endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });

  it("refuses anything that is not a string", () => {
    for (const value of [null, undefined, 42, {}, ["https://web.push.apple.com/x"]]) expect(isAllowedPushEndpoint(value)).toBe(false);
  });
});

describe("parseSubscription", () => {
  it("accepts what PushSubscription.toJSON() gives, and strips base64 padding", () => {
    const parsed = parseSubscription(sub("https://web.push.apple.com/QGf0abc", { p256dh: P256DH, auth: `${AUTH}==` }));
    expect(parsed).toEqual({ ok: true, value: { endpoint: "https://web.push.apple.com/QGf0abc", p256dh: P256DH, auth: AUTH } });
  });

  it.each(["http://web.push.apple.com/x", "https://localhost/x", "https://169.254.169.254/x", "https://evil.com/x", "https://apple.com.evil.com/x"])(
    "refuses the evil endpoint %s",
    (endpoint) => {
      const parsed = parseSubscription(sub(endpoint));
      expect(parsed.ok).toBe(false);
    },
  );

  it("refuses keys that are not base64url of a plausible length", () => {
    const bad = [
      { p256dh: "short", auth: AUTH },
      { p256dh: P256DH, auth: "tiny" },
      { p256dh: `${P256DH.slice(0, 80)}+/+/+/+`, auth: AUTH },
      { p256dh: P256DH.repeat(2), auth: AUTH },
      { p256dh: P256DH, auth: AUTH.repeat(2) },
      { p256dh: 123, auth: AUTH },
      { p256dh: P256DH },
      { p256dh: P256DH, auth: AUTH, extra: "x" },
      null,
      [P256DH, AUTH],
    ];
    for (const keys of bad) expect(parseSubscription(sub("https://web.push.apple.com/x", keys)).ok, JSON.stringify(keys)).toBe(false);
  });

  it("refuses anything that is not a subscription object", () => {
    for (const value of [null, undefined, "https://web.push.apple.com/x", [], 1]) expect(parseSubscription(value).ok).toBe(false);
    expect(parseSubscription({ ...sub("https://web.push.apple.com/x"), extra: 1 }).ok).toBe(false);
    expect(parseSubscription({ ...sub("https://web.push.apple.com/x"), expirationTime: "soon" }).ok).toBe(false);
  });
});

describe("device labels", () => {
  it("names the device from the browser, never from typed text", () => {
    expect(deviceLabelFrom("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("iPhone");
    expect(deviceLabelFrom("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe("iPad");
    expect(deviceLabelFrom("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe("Mac");
    expect(deviceLabelFrom("Mozilla/5.0 (Linux; Android 15)")).toBe("Android");
    expect(cleanDeviceLabel("iPhone")).toBe("iPhone");
    expect(cleanDeviceLabel("<script>")).toBe("Browser");
    expect(cleanDeviceLabel(42)).toBe("Browser");
  });
});
