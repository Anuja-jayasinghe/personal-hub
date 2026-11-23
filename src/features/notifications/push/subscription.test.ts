import { createECDH, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateRequestDetails, generateVAPIDKeys } from "web-push";
import { cleanDeviceLabel, deviceLabelFrom, isAllowedPushEndpoint, parseSubscription } from "./subscription";
import { hostWebPushWouldContact } from "./transport";

const ALLOWED = [
  "https://web.push.apple.com/QGf0abc",
  "https://api.push.apple.com/3/device/xyz",
  "https://fcm.googleapis.com/fcm/send/abc:def",
  "https://android.googleapis.com/gcm/send/abc",
  "https://updates.push.services.mozilla.com/wpush/v2/gAAA",
  "https://wns2-par02p.notify.windows.com/w/?token=abc",
];

/** Made-up keys of the right shape: a 65-byte public key (87 characters) and a 16-byte secret (22). */
const P256DH = `B${"A".repeat(86)}`;
const AUTH = "abcdefghijklmnopqrstuv";
const sub = (endpoint: unknown, keys: unknown = { p256dh: P256DH, auth: AUTH }) => ({ endpoint, expirationTime: null, keys });

describe("push endpoint allowlist (no server-side request forgery)", () => {
  it.each(ALLOWED)("allows %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    ["a %2e escape in the host (web-push would contact evil.com)", "https://evil.com%2eweb.push.apple.com/x"],
    ["a %2e escape in front of an IP address", "https://127.0.0.1%2efcm.googleapis.com/x"],
    ["one slash", "https:/fcm.googleapis.com/x"],
    ["no slashes", "https:fcm.googleapis.com/x"],
    ["backslashes", "https:\\\\fcm.googleapis.com/x"],
    ["a soft hyphen in the host", "https://fcm.google­apis.com/x"],
    ["a tab in the host", "https://fcm.google\tapis.com/x"],
    ["a newline in the host", "https://fcm.googleapis.com\n/x"],
    ["a tab in the path", "https://fcm.googleapis.com/x\ty"],
    ["Google Cloud Storage", "https://storage.googleapis.com/bucket/x"],
    ["any other googleapis host", "https://www.googleapis.com/x"],
    ["two labels under push.apple.com", "https://a.b.push.apple.com/x"],
    ["upper case (not canonical)", "https://FCM.googleapis.com/x"],
    ["no path", "https://fcm.googleapis.com"],
    ["an explicit default port", "https://fcm.googleapis.com:443/x"],
    ["a punycode look-alike", "https://xn--fcm-googleapis-com.evil/x"],
  ])("refuses %s", (_why, endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });

  it("every accepted endpoint is contacted by web-push itself at exactly the host that was checked", () => {
    const ecdh = createECDH("prime256v1");
    ecdh.generateKeys();
    const keys = { p256dh: ecdh.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") };
    const vapidDetails = { subject: "https://hub.example.com", ...generateVAPIDKeys() };
    for (const endpoint of ALLOWED) {
      const details = generateRequestDetails({ endpoint, keys }, "{}", { vapidDetails });
      expect(details.endpoint).toBe(endpoint);
      expect(hostWebPushWouldContact(details.endpoint), endpoint).toBe(new URL(endpoint).hostname);
    }
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
