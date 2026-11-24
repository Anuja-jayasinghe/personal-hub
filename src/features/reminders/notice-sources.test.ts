import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/read";
import { appSettings, electricityBills, electricityMeters, electricityReadings, notifications, people } from "@/db/schema";
import { makeTestDb } from "@/test/pglite";

/**
 * The event sources of N.4 (C142) end to end with the daily run, against an in-memory Postgres.
 * `readDb()` throws, so a source that reached for it (in production: the DEMO database) would fail.
 * Made-up data only; the test database never connects anywhere.
 */
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/db/read", () => ({
  readDb: async () => {
    throw new Error("readDb must not be used when a database is passed in");
  },
}));

const { loadSources, noticeSources, reminderSources, SOURCE_AREA } = await import("./sources");
const { runDaily } = await import("@/features/notifications/daily");
const { computeReminders } = await import("./engine");

const OWNER = "owner@example.com";
const at = (day: string) => new Date(`${day}T02:10:00Z`); // 07:40 in Colombo

let db: Db;
let meterA: string;
let meterB: string;

const rowsOf = () => db.select().from(notifications).where(sql`${notifications.recipient} = ${OWNER}`);
const addBill = (meterId: string, readingDate: string, currentReading: string) =>
  db.insert(electricityBills).values({ meterId, billDate: readingDate, readingDate, previousReading: "0", currentReading, units: "100", amount: "4250.00" });
const addReading = (meterId: string, readingDate: string, value: string) => db.insert(electricityReadings).values({ meterId, readingDate, value });
const run = (day: string) => runDaily({ db, now: at(day), allowedEmails: OWNER, sources: [] });

beforeEach(async () => {
  ({ db } = await makeTestDb());
  [{ id: meterA }, { id: meterB }] = await db
    .insert(electricityMeters)
    .values([
      { name: "Meter A", accountNumber: "DEMO-ACCOUNT-0042" },
      { name: "Meter B", accountNumber: "DEMO-ACCOUNT-0043" },
    ])
    .returning({ id: electricityMeters.id });
}, 60_000);

describe("event sources", () => {
  it("are separate from the reminder sources, so the Reminders page and Home never list them", async () => {
    expect(noticeSources.map((s) => s.key).sort()).toEqual(["access-requests", "electricity-notices"]);
    const reminderKeys = new Set(reminderSources.map((s) => s.key));
    for (const s of noticeSources) expect(reminderKeys.has(s.key)).toBe(false);
    expect(SOURCE_AREA["electricity-notices"]).toBe("electricity_readings");
    expect(SOURCE_AREA["access-requests"]).toBe("owner");

    // Even with a meter near its limit and someone waiting, the reminders are only the dated ones.
    await addBill(meterA, "2026-11-01", "1000");
    await addReading(meterA, "2026-11-19", "1108");
    await db.insert(people).values({ email: "stranger@example.net", status: "pending" });
    const { loaded } = await loadSources(reminderSources, { db, today: "2026-11-20" });
    expect(loaded.flatMap((l) => l.items)).toEqual([]);
    expect(computeReminders(loaded.flatMap((l) => l.items), "2026-11-20", [30, 14, 7, 1, 0])).toEqual([]);
  });

  it("read the passed database, never readDb()", async () => {
    await addBill(meterA, "2026-11-01", "1000");
    await addReading(meterA, "2026-11-19", "1111");
    await db.insert(people).values({ email: "stranger@example.net", status: "pending" });
    const { loaded, failedSources } = await loadSources(noticeSources, { db, today: "2026-11-20" });
    expect(failedSources).toEqual([]);
    const events = loaded.flatMap((l) => l.items);
    expect(events.map((e) => e.event).sort()).toEqual(["access-request", "reading-due", "slab-near"]);
  });
});

describe("the daily run with events", () => {
  it("a meter near its limit is one push, once per cycle (the rules in Settings apply)", async () => {
    await db.insert(appSettings).values({ key: "rules", value: { nearUnits: 15 } });
    await addBill(meterA, "2026-11-01", "1000");
    await addReading(meterA, "2026-11-19", "1108");

    const first = await run("2026-11-20");
    expect(first.messages.push).toBe(1);
    const rows = await rowsOf();
    expect(rows.filter((r) => r.kind === "slab-near").map((r) => ({ key: r.dedupeKey, title: r.title, body: r.body, channel: r.channel, status: r.status }))).toEqual([
      { key: `slab:${meterA}:near:2026-11-01`, title: "108 of 120 units used", body: "Meter A · 12 left, 11 days to the bill", channel: "push", status: "dry_run" },
    ]);

    // Nothing changes: nothing is written.
    const again = await run("2026-11-20");
    expect(again.messages).toEqual({ email: 0, push: 0 });
    expect((await rowsOf()).filter((r) => r.kind === "slab-near")).toHaveLength(1);
    await run("2026-11-21");
    expect((await rowsOf()).filter((r) => r.kind === "slab-near")).toHaveLength(1);

    // A new bill starts a new cycle: it fires again.
    await addBill(meterA, "2026-12-01", "1108");
    await addReading(meterA, "2026-12-10", "1225");
    await run("2026-12-10");
    const near = (await rowsOf()).filter((r) => r.kind === "slab-near").map((r) => r.dedupeKey);
    expect(near.sort()).toEqual([`slab:${meterA}:near:2026-11-01`, `slab:${meterA}:near:2026-12-01`]);
  });

  it("an archived meter sends nothing", async () => {
    await db.update(electricityMeters).set({ archivedAt: new Date() }).where(sql`${electricityMeters.id} = ${meterA}`);
    await addBill(meterA, "2026-11-01", "1000");
    await addReading(meterA, "2026-11-19", "1180");
    const report = await run("2026-11-20");
    expect(report.messages).toEqual({ email: 0, push: 0 });
    expect(await rowsOf()).toEqual([]);
  });

  it("a reading overdue is one push, stops after a new reading, and starts over from it", async () => {
    await addReading(meterA, "2026-11-15", "1000");
    await addReading(meterB, "2026-11-19", "2000");
    const early = await run("2026-11-19");
    expect(early.messages).toEqual({ email: 0, push: 0 });

    // Meter A is 5 days past its last reading (the default "check every 5 days"), B is not.
    await run("2026-11-20");
    let rows = (await rowsOf()).filter((r) => r.kind === "reading-due");
    expect(rows.map((r) => ({ key: r.dedupeKey, title: r.title, body: r.body }))).toEqual([{ key: `reading-due:${meterA}:2026-11-15`, title: "Meter reading due", body: "Meter A" }]);
    await run("2026-11-21");
    expect((await rowsOf()).filter((r) => r.kind === "reading-due" && r.body === "Meter A")).toHaveLength(1);

    // Both are read; the notice for the old readings never comes back, the new ones start over.
    await addReading(meterA, "2026-11-22", "1010");
    await addReading(meterB, "2026-11-22", "2010");
    await run("2026-11-23");
    expect((await rowsOf()).filter((r) => r.kind === "reading-due")).toHaveLength(1);
    await run("2026-11-27");
    rows = (await rowsOf()).filter((r) => r.kind === "reading-due");
    expect(rows.map((r) => r.dedupeKey).sort()).toEqual([`reading-due:${meterA}:2026-11-15`, `reading-due:${meterA}:2026-11-22`, `reading-due:${meterB}:2026-11-22`].sort());
  });

  it("nothing in an account number, an amount or a reading ever reaches a row", async () => {
    await addBill(meterA, "2026-11-01", "1000");
    await addReading(meterA, "2026-11-19", "1108");
    await db.insert(people).values({ email: "stranger@example.net", name: "Some Stranger", status: "pending", createdAt: new Date("2026-11-20T04:00:00Z") });
    await run("2026-11-20");
    const text = (await rowsOf()).map((r) => `${r.title} ${r.body} ${r.href}`).join("\n");
    expect(text).not.toMatch(/DEMO-ACCOUNT|0042|4250|4,250|LKR|1108|1000|stranger|Stranger|example\.net|@/);
  });

  it("a sign-up request the instant push never announced goes out in the daily run, once, owner only", async () => {
    await db.insert(people).values({ email: "stranger@example.net", status: "pending", createdAt: new Date("2026-11-20T04:00:00Z") });
    const first = await runDaily({ db, now: at("2026-11-20"), allowedEmails: `${OWNER}, second@example.com`, sources: [] });
    expect(first.recipients).toBe(2);
    expect(first.messages.push).toBe(2);
    await runDaily({ db, now: at("2026-11-21"), allowedEmails: `${OWNER}, second@example.com`, sources: [] });
    const rows = await db.select().from(notifications);
    expect(rows.filter((r) => r.kind === "access-request")).toHaveLength(2);
    expect(new Set(rows.map((r) => r.recipient))).toEqual(new Set([OWNER, "second@example.com"]));
  });
});
