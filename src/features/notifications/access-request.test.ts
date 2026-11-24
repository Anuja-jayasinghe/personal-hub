import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/read";
import { appSettings, notifications, people } from "@/db/schema";
import { makeTestDb } from "@/test/pglite";
import { NotSentError, type ChannelSender } from "./channels";
import type { Message } from "./planner";

/**
 * "Someone asked for access", right away (N.4, C142), against an in-memory Postgres with a fake push
 * sender. `readDb()` throws, so the instant path can only use the database it is given (never the demo).
 * Made-up addresses only; nothing leaves the test.
 */
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/db/read", () => ({
  readDb: async () => {
    throw new Error("readDb must not be used by the sign-up notice");
  },
}));

const { claimKey, notifyAccessRequest } = await import("./access-request");
const { runDaily } = await import("./daily");
const { pushPayload } = await import("./push/payload");

const OWNER = "owner@example.com";
const SECOND_OWNER = "second@example.com";
const STRANGER = "stranger@example.net";
// 11:30 in Colombo, after the morning run; the request came in at 10:30.
const NOW = new Date("2026-11-23T06:00:00Z");
const CAME_IN = new Date("2026-11-23T05:00:00Z");

let db: Db;
let client: Awaited<ReturnType<typeof makeTestDb>>["client"];
let sent: Message[];
let pushSend: ChannelSender["send"];

const senders = () => ({
  email: { channel: "email" as const, implemented: false, send: async () => { throw new NotSentError("no email"); } },
  push: { channel: "push" as const, implemented: true, send: (m: Message) => pushSend(m) },
});
// The send log stamps rows with the database clock, so the clock is held at the moment of each call.
const run = (extra: { now?: Date; environment?: string; allowedEmails?: string } = {}) => {
  vi.setSystemTime(extra.now ?? NOW);
  return notifyAccessRequest(db, { now: NOW, environment: "production", allowedEmails: OWNER, senders: senders(), ...extra });
};
const daily = (now: Date) => {
  vi.setSystemTime(now);
  return runDaily({ db, now, allowedEmails: OWNER, sources: [], senders: senders() });
};
const logOf = (recipient = OWNER) => db.select().from(notifications).where(sql`${notifications.recipient} = ${recipient}`);
const addPerson = async (email = STRANGER, createdAt = CAME_IN) => (await db.insert(people).values({ email, status: "pending", createdAt }).returning())[0];
const pushLive = () => db.insert(appSettings).values({ key: "notifications", value: { email: { enabled: false }, push: { enabled: true } } });

beforeEach(async () => {
  vi.useRealTimers();
  ({ db, client } = await makeTestDb());
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  sent = [];
  pushSend = async (m) => void sent.push(m);
  vi.restoreAllMocks();
}, 60_000);

describe("notifyAccessRequest", () => {
  it("pushes the owner once, with no name or email, and never again for the same person", async () => {
    await pushLive();
    const person = await addPerson();
    const first = await run();
    expect(first).toMatchObject({ skipped: false, held: 0, written: 1, sent: 1, failed: 0 });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ recipient: OWNER, channel: "push", title: "Someone asked for access", body: "Open People to review", href: "/settings/people" });
    // What reaches the phone is the push payload: title, body and a path, nothing of the person.
    expect(pushPayload(sent[0])).toBe(JSON.stringify({ title: "Someone asked for access", body: "Open People to review", href: "/settings/people" }));
    expect(`${sent[0].title} ${sent[0].body} ${sent[0].href}`).not.toMatch(/stranger|example\.net|@/i);
    const rows = await logOf();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ dedupeKey: `access-request:${person.id}`, kind: "access-request", channel: "push", status: "sent" });

    // Signing in again, or a second run, repeats nothing.
    expect(await run()).toMatchObject({ written: 0, sent: 0 });
    expect(sent).toHaveLength(1);
  });

  it("a second person is announced on their own only when the day's push is still free; otherwise held", async () => {
    await pushLive();
    await addPerson();
    await run();
    const second = await addPerson("another@example.net", new Date("2026-11-23T05:30:00Z"));
    const report = await run({ now: new Date("2026-11-23T07:00:00Z") });
    // A push already went to the owner today: nothing is sent or written, the person stays a held notice.
    expect(report).toMatchObject({ held: 1, written: 0, sent: 0 });
    expect(sent).toHaveLength(1);
    expect((await logOf()).map((r) => r.dedupeKey)).not.toContain(`access-request:${second.id}`);
  });

  it("a held request goes out in the next daily run's single push, once", async () => {
    await pushLive();
    await addPerson();
    await run();
    const second = await addPerson("another@example.net", new Date("2026-11-23T05:30:00Z"));
    await run({ now: new Date("2026-11-23T07:00:00Z") });

    // The next morning's run (07:40 in Colombo) sends it through the real planner and the real log.
    const tomorrow = new Date("2026-11-24T02:10:00Z");
    const report = await daily(tomorrow);
    expect(report.messages.push).toBe(1);
    expect(sent).toHaveLength(2);
    expect(sent[1]).toMatchObject({ title: "Someone asked for access" });
    expect((await logOf()).filter((r) => r.dedupeKey === `access-request:${second.id}`)).toHaveLength(1);

    // And never a third time.
    await daily(new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000));
    expect(sent).toHaveLength(2);
  });

  it("is held before the morning run, so an early sign-up never takes the day's push from it", async () => {
    await pushLive();
    await addPerson(STRANGER, new Date("2026-11-22T22:00:00Z")); // 03:30 in Colombo on the 23rd
    const report = await run({ now: new Date("2026-11-22T23:00:00Z") }); // 04:30
    expect(report).toMatchObject({ held: 1, written: 0, sent: 0 });
    expect(sent).toEqual([]);
    expect(await logOf()).toEqual([]);
    // The morning run then announces it.
    const morning = await daily(new Date("2026-11-23T02:10:00Z"));
    expect(morning.messages.push).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it("does nothing outside production (a preview or local development share the real database)", async () => {
    await pushLive();
    await addPerson();
    for (const environment of ["preview", "development", undefined]) {
      expect(await run({ environment })).toMatchObject({ skipped: true, written: 0, sent: 0 });
    }
    expect(sent).toEqual([]);
    expect(await logOf()).toEqual([]);
  });

  it("does nothing when nobody is pending, and a person who was approved or blocked is not announced", async () => {
    await pushLive();
    expect(await run()).toMatchObject({ written: 0, sent: 0, held: 0 });
    await db.insert(people).values([
      { email: "approved@example.net", status: "active", createdAt: CAME_IN },
      { email: "blocked@example.net", status: "blocked", createdAt: CAME_IN },
    ]);
    expect(await run()).toMatchObject({ written: 0, sent: 0 });
    expect(sent).toEqual([]);
  });

  it("only ever writes to the owners, each with their own row", async () => {
    await pushLive();
    await addPerson();
    const report = await run({ allowedEmails: `${OWNER}, ${SECOND_OWNER}` });
    expect(report.written).toBe(2);
    expect(sent.map((m) => m.recipient).sort()).toEqual([OWNER, SECOND_OWNER]);
    expect(await logOf(STRANGER)).toEqual([]);
  });

  it("is a dry run while push is not switched on: logged, never sent", async () => {
    await addPerson();
    const report = await run();
    expect(report).toMatchObject({ written: 1, sent: 0 });
    expect(sent).toEqual([]);
    expect((await logOf())[0].status).toBe("dry_run");
  });

  it("never breaks anything when the push fails: a refusal is retried at most three times, an unknown outcome never", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await pushLive();
    await addPerson();
    pushSend = async () => {
      throw new NotSentError("refused");
    };
    for (let i = 0; i < 5; i++) await expect(run()).resolves.toMatchObject({ sent: 0, failed: 0 });
    expect((await logOf()).filter((r) => r.status === "failed")).toHaveLength(3);

    vi.useRealTimers();
    ({ db, client } = await makeTestDb());
    vi.useFakeTimers({ toFake: ["Date"] });
    await pushLive();
    await addPerson();
    let calls = 0;
    pushSend = async () => {
      calls++;
      throw new Error("the connection dropped");
    };
    await run();
    await run();
    expect(calls).toBe(1);
    expect((await logOf())[0].status).toBe("pending");
    // It builds a second in-memory database, which takes more than the default 5 s on a busy machine.
  }, 60_000);

  it("swallows a database failure for one owner and carries on, logging only the error's name", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await pushLive();
    await addPerson();
    await client.exec(`
      create function refuse_broken() returns trigger language plpgsql as $$
      begin
        if new.recipient = 'broken@example.com' then raise exception 'refused for broken@example.com'; end if;
        return new;
      end $$;
      create trigger refuse_broken before insert on notifications for each row execute function refuse_broken();
    `);
    const report = await run({ allowedEmails: `broken@example.com, ${OWNER}` });
    expect(report.failed).toBe(1);
    expect(report.sent).toBe(1);
    expect(log.mock.calls.flat().join(" ")).not.toContain("broken@example.com");
  });

  describe("the day's claim on an owner's instant push", () => {
    const claims = () => db.select().from(appSettings).where(sql`${appSettings.key} like 'access-request-push:%'`);

    it("is taken by a send and kept", async () => {
      await pushLive();
      await addPerson();
      await run();
      expect((await claims()).map((c) => c.key)).toEqual([claimKey(OWNER, "2026-11-23")]);
    });

    // The claim is what stops two DIFFERENT people's sends (each planned before the other's row existed); the next test pins that.
    it("two sign-ups at the same instant send one push between them", async () => {
      await pushLive();
      await addPerson();
      await addPerson("another@example.net", new Date("2026-11-23T05:10:00Z"));
      const [a, b] = await Promise.all([run(), run()]);
      expect(sent).toHaveLength(1);
      expect(a.sent + b.sent).toBe(1);
    });

    it("a lost claim holds the notice: nothing sent, nothing written, and the daily run announces the person", async () => {
      await pushLive();
      // Another sign-up's send won the claim and has not written its log row yet.
      await db.insert(appSettings).values({ key: claimKey(OWNER, "2026-11-23"), value: {} });
      const person = await addPerson();
      expect(await run()).toMatchObject({ held: 1, written: 0, sent: 0 });
      expect(sent).toEqual([]);
      expect(await logOf()).toEqual([]);
      const next = await daily(new Date("2026-11-24T02:10:00Z"));
      expect(next.messages.push).toBe(1);
      expect((await logOf()).map((r) => r.dedupeKey)).toEqual([`access-request:${person.id}`]);
    });

    it("is given back when the push service refused it, so a later sign-up can still send", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      await pushLive();
      await addPerson();
      pushSend = async () => {
        throw new NotSentError("refused");
      };
      await run();
      expect(await claims()).toEqual([]);
      pushSend = async (m) => void sent.push(m);
      await run();
      expect(sent).toHaveLength(1);
      expect(await claims()).toHaveLength(1);
    });

    it("is kept when the outcome is unknown, so nothing is sent twice", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      await pushLive();
      await addPerson();
      pushSend = async () => {
        throw new Error("the connection dropped");
      };
      await run();
      expect(await claims()).toHaveLength(1);
    });
  });
});
