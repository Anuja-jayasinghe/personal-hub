import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/read";
import { appSettings, notifications, pushSubscriptions } from "@/db/schema";
import { makeTestDb } from "@/test/pglite";
import { NotSentError, type ChannelSender } from "../channels";
import { sendLive } from "../log";
import { systemMessage } from "../system";
import { pushGoneDedupeKey, recordPushGone } from "./gone";
import { createPushSender, type PushTarget, type PushTransport } from "./sender";

/**
 * The iPhone push sender against an in-memory Postgres, with a fake push service in place of web-push.
 * Made-up addresses and keys only; nothing leaves the test.
 */

const OWNER = "owner@example.com";
const P256DH = `B${"A".repeat(86)}`;
const AUTH = "abcdefghijklmnopqrstuv";
const NOW = new Date("2026-11-23T02:10:00Z");

let db: Db;

beforeEach(async () => {
  ({ db } = await makeTestDb());
}, 60_000);

async function addDevice(endpoint = "https://web.push.apple.com/device-1", recipient = OWNER) {
  const [row] = await db.insert(pushSubscriptions).values({ recipient, endpoint, p256dh: P256DH, auth: AUTH, deviceLabel: "iPhone" }).returning();
  return row;
}

const message = (recipient = OWNER) =>
  systemMessage({ recipient, channel: "push", kind: "push-test", dedupeKey: `push-test:${Math.random()}`, title: "Insurance ends tomorrow", body: "Silver car", href: "/vehicles/v1", today: "2026-11-23" });

/** A fake push service answering `status` (or throwing, for a timeout), remembering what it was given. */
function fakeService(status: number | "timeout") {
  const calls: { target: PushTarget; payload: string }[] = [];
  const transport: PushTransport = async (target, payload) => {
    calls.push({ target, payload });
    if (status === "timeout") throw new Error("The push service did not answer");
    return status;
  };
  return { calls, transport };
}

const quiet = () => vi.spyOn(console, "error").mockImplementation(() => {});

describe("createPushSender", () => {
  it("is not implemented without the VAPID keys, and refuses to send", async () => {
    const sender = createPushSender({ db, transport: null });
    expect(sender.implemented).toBe(false);
    await expect(sender.send(message())).rejects.toBeInstanceOf(NotSentError);
  });

  it("201: delivered, last_ok_at stamped, payload is { title, body, href } only", async () => {
    const device = await addDevice();
    const { calls, transport } = fakeService(201);
    const sender = createPushSender({ db, transport, now: () => NOW });
    expect(sender.implemented).toBe(true);
    await sender.send(message());
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
    await createPushSender({ db, transport }).send(message());
    expect(calls.map((c) => c.target.endpoint)).toEqual(["https://web.push.apple.com/mine"]);
  });

  it("an href that is not a path on the hub becomes /", async () => {
    await addDevice();
    const { calls, transport } = fakeService(201);
    await createPushSender({ db, transport }).send({ ...message(), href: "https://evil.com/x" });
    expect(JSON.parse(calls[0].payload).href).toBe("/");
  });

  it.each([404, 410])("%s: deletes the subscription and writes ONE stopped-accepting email notice, once", async (status) => {
    quiet();
    const device = await addDevice();
    const { transport } = fakeService(status);
    const sender = createPushSender({ db, transport, now: () => NOW });
    await expect(sender.send(message())).rejects.toBeInstanceOf(NotSentError);
    expect(await db.select().from(pushSubscriptions)).toEqual([]);

    const rows = await db.select().from(notifications).where(eq(notifications.recipient, OWNER));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      channel: "email",
      kind: "push-gone",
      dedupeKey: pushGoneDedupeKey(device.id),
      title: "iPhone stopped accepting pushes",
      href: "/settings/notifications",
      // Email is not built yet (N.2), so it is a dry run.
      status: "dry_run",
    });

    // Recording it again for the same subscription writes nothing more.
    await recordPushGone(db, { recipient: OWNER, subscriptionId: device.id, deviceLabel: "iPhone", now: NOW, emailSender: { implemented: false, send: async () => {} } });
    expect(await db.select().from(notifications).where(eq(notifications.recipient, OWNER))).toHaveLength(1);
    // And a second send finds no device, so nothing else is written either.
    await expect(sender.send(message())).rejects.toBeInstanceOf(NotSentError);
    expect(await db.select().from(notifications).where(eq(notifications.recipient, OWNER))).toHaveLength(1);
  });

  it("the stopped-accepting email goes live once email is built and on, but never as a second email that day", async () => {
    const sent: string[] = [];
    const email: Pick<ChannelSender, "implemented" | "send"> = { implemented: true, send: async (m) => void sent.push(m.title) };
    await db.insert(appSettings).values({ key: "notifications", value: { email: { enabled: true }, push: { enabled: true } } });

    const first = "00000000-0000-4000-8000-000000000001";
    await recordPushGone(db, { recipient: OWNER, subscriptionId: first, deviceLabel: "iPhone", now: NOW, emailSender: email });
    expect(sent).toEqual(["hub · iPhone stopped accepting pushes"]);

    // A second device gone the same day: logged, not sent (one email a day per person).
    const second = "00000000-0000-4000-8000-000000000002";
    await recordPushGone(db, { recipient: OWNER, subscriptionId: second, deviceLabel: "iPad", now: NOW, emailSender: email });
    expect(sent).toHaveLength(1);
    const rows = await db.select({ key: notifications.dedupeKey, status: notifications.status }).from(notifications).where(eq(notifications.recipient, OWNER));
    expect(rows.sort((a, b) => a.key.localeCompare(b.key))).toEqual([
      { key: pushGoneDedupeKey(first), status: "sent" },
      { key: pushGoneDedupeKey(second), status: "dry_run" },
    ]);
  });

  it("400: refused, NotSentError, the subscription is kept", async () => {
    await addDevice();
    const { transport } = fakeService(400);
    await expect(createPushSender({ db, transport }).send(message())).rejects.toBeInstanceOf(NotSentError);
    expect(await db.select().from(pushSubscriptions)).toHaveLength(1);
    expect(await db.select().from(notifications)).toEqual([]);
  });

  it.each([500, 503, "timeout"] as const)("%s: unknown outcome (a plain error, not NotSentError)", async (status) => {
    const log = quiet();
    await addDevice();
    const { transport } = fakeService(status);
    const err = await createPushSender({ db, transport })
      .send(message())
      .then(() => null)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(NotSentError);
    expect(await db.select().from(pushSubscriptions)).toHaveLength(1);
    // Nothing about the device reaches the log.
    for (const call of log.mock.calls) expect(String(call)).not.toMatch(/web\.push\.apple\.com|device-1|AAAA/);
  });

  it("counts as sent when one device takes it, even if another is gone", async () => {
    quiet();
    await addDevice("https://web.push.apple.com/ok");
    await addDevice("https://web.push.apple.com/gone");
    const transport: PushTransport = async (target) => (target.endpoint.endsWith("/ok") ? 201 : 410);
    await createPushSender({ db, transport }).send(message());
    expect((await db.select().from(pushSubscriptions)).map((s) => s.endpoint)).toEqual(["https://web.push.apple.com/ok"]);
  });

  it("never contacts a stored endpoint that is not a real push service", async () => {
    await addDevice("https://evil.com/collect");
    const { calls, transport } = fakeService(201);
    await expect(createPushSender({ db, transport }).send(message())).rejects.toBeInstanceOf(NotSentError);
    expect(calls).toEqual([]);
  });

  it("through the send log: 201 is sent, 400 failed, 500 left pending", async () => {
    quiet();
    await addDevice();
    const outcome = async (status: number) => {
      const { transport } = fakeService(status);
      return sendLive(db, message(), createPushSender({ db, transport }));
    };
    expect(await outcome(201)).toMatchObject({ sent: 1, failed: 0, unknown: 0 });
    expect(await outcome(400)).toMatchObject({ sent: 0, failed: 1, unknown: 0 });
    expect(await outcome(500)).toMatchObject({ sent: 0, failed: 0, unknown: 1 });
  });
});
