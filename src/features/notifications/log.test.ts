import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/read";
import * as schema from "@/db/schema";
import { notifications } from "@/db/schema";
import type { ReminderItem } from "@/features/reminders/engine";
import { channelModes, parseSwitches } from "./channels";
import { channelsUsedOn, pruneLog, readLog, recordDryRun, sendLive, usedKeysFrom, type LogRow } from "./log";
import { planNotifications, type Message } from "./planner";

/**
 * The send log against a real Postgres (PGlite, in memory, built from the same migrations as Supabase
 * and the demo). Nothing here touches the real database.
 */

let db: Db;

beforeAll(async () => {
  const client = new PGlite();
  const local = drizzle({ client, schema });
  await migrate(local, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  db = local as unknown as Db;
}, 60_000);

const TODAY = "2026-11-23";
const items: ReminderItem[] = [
  { id: "renewal:r1", title: "Insurance · Silver car", dueDate: "2026-12-23", href: "/vehicles/v1", kind: "renewal", notice: { what: "Insurance", who: "Silver car" } },
  { id: "renewal:r2", title: "Revenue license · Blue bike", dueDate: "2026-12-13", href: "/vehicles/v2", kind: "renewal", notice: { what: "Revenue license", who: "Blue bike" } },
];

function emailFor(recipient: string): Message {
  const plan = planNotifications({ recipient, items, today: TODAY, usedKeys: new Set() });
  return plan.messages.find((m) => m.channel === "email")!;
}

const DRY = channelModes(parseSwitches(null));
const LIVE_EMAIL = { email: "live", push: "dry" } as const;

describe("dry run", () => {
  it("writes one dry_run row per notice, and never twice", async () => {
    const message = emailFor("dry@example.com");
    expect((await recordDryRun(db, message)).written).toBe(2);
    expect((await recordDryRun(db, message)).written).toBe(0);
    const rows = await readLog(db, "dry@example.com");
    expect(rows.map((r) => r.status)).toEqual(["dry_run", "dry_run"]);
  });

  it("all channels are dry in N.1, even if switched on", () => {
    expect(channelModes(parseSwitches({ email: { enabled: true }, push: { enabled: true } }))).toEqual({ email: "dry", push: "dry" });
  });
});

describe("a real send", () => {
  it("is not blocked by an earlier dry run of the same key, and is stamped sent", async () => {
    const message = emailFor("golive@example.com");
    await recordDryRun(db, message);
    const sent: Message[] = [];
    const result = await sendLive(db, message, { send: async (m) => void sent.push(m) });
    expect(result).toMatchObject({ written: 2, sent: 2, failed: 0 });
    expect(sent).toHaveLength(1);
    expect(sent[0].title).toBe("hub · 2 things coming up");
    const rows = await db.select().from(notifications).where(eq(notifications.recipient, "golive@example.com"));
    expect(rows.filter((r) => r.status === "sent").every((r) => r.sentAt !== null)).toBe(true);
    expect(rows.map((r) => r.status).sort()).toEqual(["dry_run", "dry_run", "sent", "sent"]);
  });

  it("can never be repeated: a second run sends nothing", async () => {
    const message = emailFor("twice@example.com");
    let calls = 0;
    await sendLive(db, message, { send: async () => void calls++ });
    const again = await sendLive(db, message, { send: async () => void calls++ });
    expect(again).toMatchObject({ written: 0, sent: 0, message: null });
    expect(calls).toBe(1);
  });

  it("writes the row before sending, so a crash after the write never sends again", async () => {
    const message = emailFor("crash@example.com");
    // A run that wrote its pending rows and then died before sending.
    await db.insert(notifications).values(
      message.notices.map((n) => ({ recipient: "crash@example.com", dedupeKey: n.dedupeKey, channel: n.channel, kind: n.event, title: n.title, body: n.body, href: n.href, dueDate: n.dueDate, status: "pending" as const })),
    );
    let calls = 0;
    expect((await sendLive(db, message, { send: async () => void calls++ })).written).toBe(0);
    expect(calls).toBe(0);
  });

  it("sends only the notices it could claim", async () => {
    const message = emailFor("partial@example.com");
    const [first] = message.notices;
    await db.insert(notifications).values({ recipient: "partial@example.com", dedupeKey: first.dedupeKey, channel: "email", kind: first.event, title: first.title, body: first.body, href: first.href, dueDate: first.dueDate, status: "sent", sentAt: new Date() });
    const sent: Message[] = [];
    await sendLive(db, message, { send: async (m) => void sent.push(m) });
    expect(sent[0].notices.map((n) => n.dedupeKey)).toEqual([message.notices[1].dedupeKey]);
  });

  it("records a failure with its error and does not retry it", async () => {
    const message = emailFor("fail@example.com");
    const result = await sendLive(db, message, {
      send: async () => {
        throw new Error("provider said no");
      },
    });
    expect(result).toMatchObject({ sent: 0, failed: 2 });
    const rows = await db.select().from(notifications).where(eq(notifications.recipient, "fail@example.com"));
    expect(rows.map((r) => [r.status, r.error])).toEqual([
      ["failed", "provider said no"],
      ["failed", "provider said no"],
    ]);
    const log = await readLog(db, "fail@example.com");
    expect(planNotifications({ items, today: TODAY, usedKeys: usedKeysFrom(log, LIVE_EMAIL) }).notices).toEqual([]);
  });

  it("the database itself refuses a second real row for the same recipient and key", async () => {
    const row = { recipient: "db@example.com", dedupeKey: "task:t1:act:2026-11-23", channel: "push" as const, kind: "task", title: "Task due today", body: "x", href: "/tasks", dueDate: "2026-11-23" };
    await db.insert(notifications).values({ ...row, status: "sent", sentAt: new Date() });
    await expect(db.insert(notifications).values({ ...row, status: "pending" })).rejects.toThrow();
    // A dry-run row of the same key is still allowed (once).
    await db.insert(notifications).values({ ...row, status: "dry_run" });
    await expect(db.insert(notifications).values({ ...row, status: "dry_run" })).rejects.toThrow();
  });

  it("checks its columns", async () => {
    const row = { dedupeKey: "k", kind: "task", title: "t", body: "b", href: "/", dueDate: "2026-11-23" };
    await expect(db.insert(notifications).values({ ...row, recipient: "Upper@Example.com", channel: "push", status: "dry_run" })).rejects.toThrow();
    await expect(db.insert(notifications).values({ ...row, recipient: "a@example.com", channel: "push", status: "sent" })).rejects.toThrow();
    await expect(db.execute(sql`insert into notifications (recipient, dedupe_key, channel, kind, title, body, href, due_date, status) values ('a@example.com', 'k2', 'sms', 'task', 't', 'b', '/', '2026-11-23', 'dry_run')`)).rejects.toThrow();
  });
});

describe("pruning", () => {
  it("deletes rows sent (or written) more than a year ago and keeps the rest", async () => {
    const base = { recipient: "prune@example.com", channel: "push" as const, kind: "task", title: "t", body: "b", href: "/", dueDate: "2025-01-01" };
    const now = new Date("2026-11-23T02:00:00Z");
    await db.insert(notifications).values([
      { ...base, dedupeKey: "old-sent", status: "sent", createdAt: new Date("2025-11-01T02:00:00Z"), sentAt: new Date("2025-11-01T02:00:05Z") },
      { ...base, dedupeKey: "old-dry", status: "dry_run", createdAt: new Date("2025-10-01T02:00:00Z") },
      { ...base, dedupeKey: "recent", status: "sent", createdAt: new Date("2026-01-01T02:00:00Z"), sentAt: new Date("2026-01-01T02:00:05Z") },
    ]);
    await pruneLog(db, now);
    expect((await readLog(db, "prune@example.com")).map((r) => r.dedupeKey)).toEqual(["recent"]);
  });
});

describe("reading the log", () => {
  const rows: LogRow[] = [
    { dedupeKey: "a", channel: "email", status: "dry_run", createdAt: new Date("2026-11-23T02:10:00Z") },
    { dedupeKey: "b", channel: "push", status: "sent", createdAt: new Date("2026-11-22T02:10:00Z") },
    { dedupeKey: "c", channel: "push", status: "failed", createdAt: new Date("2026-11-21T02:10:00Z") },
  ];

  it("dry-run rows count only while the channel is dry; real rows always count", () => {
    expect([...usedKeysFrom(rows, DRY)].sort()).toEqual(["a", "b", "c"]);
    expect([...usedKeysFrom(rows, LIVE_EMAIL)].sort()).toEqual(["b", "c"]);
  });

  it("knows which channels were used today, in Colombo", () => {
    expect([...channelsUsedOn(rows, DRY, "2026-11-23", "Asia/Colombo")]).toEqual(["email"]);
    expect([...channelsUsedOn(rows, LIVE_EMAIL, "2026-11-23", "Asia/Colombo")]).toEqual([]);
    // 19:00 UTC on the 22nd is already the 23rd in Colombo.
    const late: LogRow[] = [{ dedupeKey: "d", channel: "push", status: "sent", createdAt: new Date("2026-11-22T19:00:00Z") }];
    expect([...channelsUsedOn(late, DRY, "2026-11-23", "Asia/Colombo")]).toEqual(["push"]);
  });
});
