import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/read";
import { appSettings, notifications, pushSubscriptions } from "@/db/schema";
import { makeTestDb } from "@/test/pglite";
import { NotSentError, type ChannelSender } from "../channels";
import { sendLive } from "../log";
import { composeMessage } from "../planner";
import { systemMessage } from "../system";
import { clearLoggedGone, deliverGoneNotices, pushGoneDedupeKey, pushGoneNotices, withGoneNotices } from "./gone";
import { createPushSender, endpointHash, type PushSenderDeps, type PushTarget, type PushTransport } from "./sender";

/**
 * The iPhone push sender against an in-memory Postgres, with a fake push service in place of web-push.
 * Made-up addresses and keys only; nothing leaves the test.
 */
vi.mock("server-only", () => ({}));

const OWNER = "owner@example.com";
const P256DH = `B${"A".repeat(86)}`;
const AUTH = "abcdefghijklmnopqrstuv";
const NOW = new Date("2026-11-23T02:10:00Z");
const TODAY = "2026-11-23";
const NO_EMAIL: PushSenderDeps["emailSender"] = { implemented: false, send: async () => {} };

let db: Db;

beforeEach(async () => {
  ({ db } = await makeTestDb());
}, 60_000);

async function addDevice(endpoint = "https://web.push.apple.com/device-1", recipient = OWNER, deviceLabel = "iPhone") {
  const [row] = await db.insert(pushSubscriptions).values({ recipient, endpoint, p256dh: P256DH, auth: AUTH, deviceLabel }).returning();
  return row;
}

const message = (recipient = OWNER) =>
  systemMessage({ recipient, channel: "push", kind: "push-test", dedupeKey: `push-test:${Math.random()}`, title: "Insurance ends tomorrow", body: "Silver car", href: "/vehicles/v1", today: TODAY });

/** A fake push service answering `status` (or throwing, for a timeout or a local refusal), remembering what it was given. */
function fakeService(status: number | "timeout" | "local") {
  const calls: { target: PushTarget; payload: string }[] = [];
  const transport: PushTransport = async (target, payload) => {
    calls.push({ target, payload });
    if (status === "timeout") throw new Error("The push service did not answer");
    if (status === "local") throw new NotSentError("The push could not be prepared for this device.");
    return status;
  };
  return { calls, transport };
}

const sender = (transport: PushTransport | null, extra: Partial<PushSenderDeps> = {}) => createPushSender({ db, transport, emailSender: NO_EMAIL, now: () => NOW, ...extra });
const quiet = () => vi.spyOn(console, "error").mockImplementation(() => {});
const logOf = (recipient = OWNER) => db.select().from(notifications).where(eq(notifications.recipient, recipient));

describe("createPushSender", () => {
  it("is not implemented without the VAPID keys, and refuses to send", async () => {
    const s = sender(null);
    expect(s.implemented).toBe(false);
    await expect(s.send(message())).rejects.toBeInstanceOf(NotSentError);
  });

  it("no device: NotSentError, nothing contacted", async () => {
    const { calls, transport } = fakeService(201);
    await expect(sender(transport).send(message())).rejects.toBeInstanceOf(NotSentError);
    expect(calls).toEqual([]);
  });

  it("201: delivered, last_ok_at stamped, payload is { title, body, href } only", async () => {
    const device = await addDevice();
    const { calls, transport } = fakeService(201);
    const s = sender(transport);
    expect(s.implemented).toBe(true);
    await s.send(message());
    expect(calls).toHaveLength(1);
    expect(calls[0].target).toEqual({ endpoint: device.endpoint, keys: { p256dh: P256DH, auth: AUTH } });
    expect(JSON.parse(calls[0].payload)).toEqual({ title: "Insurance ends tomorrow", body: "Silver car", href: "/vehicles/v1" });
    const [after] = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.id, device.id));
    expect(after.lastOkAt?.toISOString()).toBe(NOW.toISOString());
  });

  it("sends only to the recipient's own devices", async () => {
    await addDevice("https://web.push.apple.com/mine");
    await addDevice("https://web.push.apple.com/theirs", "other@example.com");
    const { calls, transport } = fakeService(201);
    await sender(transport).send(message());
    expect(calls.map((c) => c.target.endpoint)).toEqual(["https://web.push.apple.com/mine"]);
  });

  it("a test push goes only to the device that asked", async () => {
    await addDevice("https://web.push.apple.com/phone");
    await addDevice("https://web.push.apple.com/tablet");
    const { calls, transport } = fakeService(201);
    await sender(transport, { onlyEndpointHash: endpointHash("https://web.push.apple.com/tablet") }).send(message());
    expect(calls.map((c) => c.target.endpoint)).toEqual(["https://web.push.apple.com/tablet"]);
    // Another owner's device never matches, even with its hash.
    await addDevice("https://web.push.apple.com/theirs", "other@example.com");
    await expect(sender(transport, { onlyEndpointHash: endpointHash("https://web.push.apple.com/theirs") }).send(message())).rejects.toBeInstanceOf(NotSentError);
  });

  it("an href that is not a path on the hub becomes /", async () => {
    await addDevice();
    const { calls, transport } = fakeService(201);
    await sender(transport).send({ ...message(), href: "https://evil.com/x" });
    expect(JSON.parse(calls[0].payload).href).toBe("/");
  });

  it.each([404, 410])("%s: the subscription goes and ONE stopped-accepting email notice is logged, once", async (status) => {
    quiet();
    const device = await addDevice();
    const { transport } = fakeService(status);
    const s = sender(transport);
    await expect(s.send(message())).rejects.toBeInstanceOf(NotSentError);
    // The notice was logged at once (email is a dry run until N.2), so the row is deleted.
    expect(await db.select().from(pushSubscriptions)).toEqual([]);
    const rows = await logOf();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      channel: "email",
      kind: "push-gone",
      dedupeKey: pushGoneDedupeKey(device.id),
      title: "iPhone stopped accepting pushes",
      href: "/settings/notifications",
      status: "dry_run",
    });
    // Nothing more to log, and a second send finds no device and writes nothing either.
    expect(await deliverGoneNotices(db, { recipient: OWNER, now: NOW, emailSender: NO_EMAIL })).toEqual({ status: "none" });
    await expect(s.send(message())).rejects.toBeInstanceOf(NotSentError);
    expect(await logOf()).toHaveLength(1);
  });

  it("the stopped-accepting email uses the run's email sender, and is HELD (not dropped) when an email already went today", async () => {
    quiet();
    const sent: string[] = [];
    const email: Pick<ChannelSender, "implemented" | "send"> = { implemented: true, send: async (m) => void sent.push(m.title) };
    // The log rows are stamped by the database clock, so this test follows the real clock too (a fixed day broke it once that day passed).
    const live = { emailSender: email, now: () => new Date() };
    await db.insert(appSettings).values({ key: "notifications", value: { email: { enabled: true }, push: { enabled: true } } });

    await addDevice("https://web.push.apple.com/phone");
    await sender(fakeService(410).transport, live)
      .send(message())
      .catch(() => {});
    expect(sent).toEqual(["hub · iPhone stopped accepting pushes"]);

    // A second device gone the same day: held, its row stays marked gone, no second email.
    const tablet = await addDevice("https://web.push.apple.com/tablet", OWNER, "iPad");
    await sender(fakeService(410).transport, live)
      .send(message())
      .catch(() => {});
    expect(sent).toHaveLength(1);
    const [held] = await db.select().from(pushSubscriptions);
    expect(held.id).toBe(tablet.id);
    expect(held.goneAt).not.toBeNull();
    expect((await logOf()).map((r) => r.dedupeKey)).not.toContain(pushGoneDedupeKey(tablet.id));

    // The next day's run puts it into that day's email (batched with what else is planned), then the row goes.
    const tomorrow = "2026-11-24";
    const gone = await pushGoneNotices(db, OWNER, tomorrow);
    const planned = composeMessage(OWNER, "email", [{ ...gone[0], dedupeKey: "renewal:r1:plan:2026-12-24", event: "renewal", title: "Insurance ends 24 Dec", body: "Insurance ends 24 Dec" }]);
    const messages = withGoneNotices(OWNER, [planned], gone, false);
    expect(messages).toHaveLength(1);
    expect(messages[0].notices.map((n) => n.event).sort()).toEqual(["push-gone", "renewal"]);
    expect(withGoneNotices(OWNER, [planned], gone, true)).toEqual([planned]);
    await sendLive(db, messages[0], email, () => new Date("2026-11-24T02:10:00Z"));
    expect(await clearLoggedGone(db, OWNER)).toBe(1);
    expect(await db.select().from(pushSubscriptions)).toEqual([]);
    expect(sent).toHaveLength(2);
  });

  it("400: refused, NotSentError, the subscription is kept", async () => {
    await addDevice();
    await expect(sender(fakeService(400).transport).send(message())).rejects.toBeInstanceOf(NotSentError);
    expect(await db.select().from(pushSubscriptions)).toHaveLength(1);
    expect(await logOf()).toEqual([]);
  });

  it("refused by web-push before any request (a bad key): NotSentError, so the notice may be retried", async () => {
    await addDevice();
    await expect(sender(fakeService("local").transport).send(message())).rejects.toBeInstanceOf(NotSentError);
  });

  it.each([500, 503, "timeout"] as const)("%s: unknown outcome (a plain error, not NotSentError)", async (status) => {
    const log = quiet();
    await addDevice();
    const err = await sender(fakeService(status).transport)
      .send(message())
      .then(() => null)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(NotSentError);
    expect(await db.select().from(pushSubscriptions)).toHaveLength(1);
    // Nothing about the device reaches the log.
    for (const call of log.mock.calls) expect(String(call)).not.toMatch(/web\.push\.apple\.com|device-1|AAAA/);
  });

  const mixed = (answers: Record<string, number>): PushTransport => async (target) => answers[target.endpoint.split("/").pop()!];

  it("counts as sent when one device takes it, even if another is gone", async () => {
    quiet();
    await addDevice("https://web.push.apple.com/ok");
    await addDevice("https://web.push.apple.com/gone");
    await sender(mixed({ ok: 201, gone: 410 })).send(message());
    expect((await db.select().from(pushSubscriptions)).map((s) => s.endpoint)).toEqual(["https://web.push.apple.com/ok"]);
  });

  it("500 on one device and 410 on another: unknown, and the gone one still logs its notice", async () => {
    quiet();
    await addDevice("https://web.push.apple.com/flaky");
    await addDevice("https://web.push.apple.com/gone");
    const err = await sender(mixed({ flaky: 500, gone: 410 }))
      .send(message())
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(NotSentError);
    expect((await db.select().from(pushSubscriptions)).map((s) => s.endpoint)).toEqual(["https://web.push.apple.com/flaky"]);
    expect((await logOf()).map((r) => r.kind)).toEqual(["push-gone"]);
  });

  it("400 on one device and 410 on another: refused (NotSentError)", async () => {
    quiet();
    await addDevice("https://web.push.apple.com/bad");
    await addDevice("https://web.push.apple.com/gone");
    await expect(sender(mixed({ bad: 400, gone: 410 })).send(message())).rejects.toBeInstanceOf(NotSentError);
    expect((await db.select().from(pushSubscriptions)).map((s) => s.endpoint)).toEqual(["https://web.push.apple.com/bad"]);
  });

  it("never contacts a stored endpoint that is not a real push service in its canonical form", async () => {
    await addDevice("https://evil.com/collect");
    await addDevice("https://evil.com%2eweb.push.apple.com/x");
    const { calls, transport } = fakeService(201);
    await expect(sender(transport).send(message())).rejects.toBeInstanceOf(NotSentError);
    expect(calls).toEqual([]);
  });

  it("through the send log: 201 is sent, 400 failed, 500 left pending", async () => {
    quiet();
    await addDevice();
    const outcome = (status: number) => sendLive(db, message(), sender(fakeService(status).transport));
    expect(await outcome(201)).toMatchObject({ sent: 1, failed: 0, unknown: 0 });
    expect(await outcome(400)).toMatchObject({ sent: 0, failed: 1, unknown: 0 });
    expect(await outcome(500)).toMatchObject({ sent: 0, failed: 0, unknown: 1 });
  });
});
