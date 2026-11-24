import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/read";
import { isNull } from "drizzle-orm";
import { appConfig } from "@/config/app.config";
import { billItems, tasks, vehicles, vehicleServices } from "@/db/schema";
import { previewUpcoming } from "@/features/notifications/planner";
import { addDays } from "@/lib/dates";
import { makeTestDb } from "@/test/pglite";

/**
 * The reminder sources outside a request (Notifications N.1, C139): the daily run passes the database
 * to every source. `readDb()` is made to throw here, so a source that still reached for it (and so,
 * in production, for the DEMO database) would fail this test. Made-up data only.
 */
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/db/read", () => ({
  readDb: async () => {
    throw new Error("readDb must not be used when a database is passed in");
  },
}));

const { loadSources, reminderSources } = await import("./sources");

const TODAY = "2026-11-23";
let db: Db;

beforeAll(async () => {
  ({ db } = await makeTestDb({ today: TODAY }));
  // Free text with an amount in it: a task title and a bill whose reminder title carries its amount.
  await db.insert(tasks).values({ title: "Pay LKR 25,000 to the plumber", status: "todo", priority: "normal", dueDate: TODAY });
  await db.insert(billItems).values({ name: "Plumber", kind: "bill", frequency: "one_off", amount: "25000.00", nextDueDate: addDays(TODAY, 1), autopay: false });
  // Service types are free text too: one typed with an amount and a name in it, one from the fixed list in another case.
  const [vehicle] = await db.select({ id: vehicles.id }).from(vehicles).where(isNull(vehicles.archivedAt)).limit(1);
  await db.insert(vehicleServices).values([
    { vehicleId: vehicle.id, serviceDate: addDays(TODAY, -100), serviceType: "Chain job LKR 9,000 at Silva garage", nextDueDate: TODAY },
    // The newest of the oil-change types (V.1b: one cycle) decides the reminder, so this one is newer than the sample ones.
    { vehicleId: vehicle.id, serviceDate: addDays(TODAY, -1), serviceType: "oil CHANGE", nextDueDate: TODAY },
  ]);
}, 60_000);

describe("reminder sources with a database passed in", () => {
  it("every source reads the passed database, never readDb()", async () => {
    const { loaded, failedSources } = await loadSources(reminderSources, { db, today: TODAY });
    expect(failedSources).toEqual([]);
    expect(loaded.map((l) => l.key).sort()).toEqual(reminderSources.map((s) => s.key).sort());
    for (const l of loaded) expect(l.items.length, l.key).toBeGreaterThan(0);
  });

  it("a notification never carries a task's free text or an amount, through the real source mapping", async () => {
    const { loaded } = await loadSources(reminderSources, { db, today: TODAY });
    const items = loaded.flatMap((l) => l.items);
    const task = items.find((i) => i.title.startsWith("Pay LKR"))!;
    expect(task.notice).toEqual({ what: "Task" });
    const bill = items.find((i) => i.title.startsWith("Plumber"))!;
    expect(bill.title).toMatch(/25,000/);
    expect(bill.notice).toEqual({ what: "Plumber" });

    const messages = previewUpcoming(items, TODAY, new Set(), 45).flatMap((d) => d.messages);
    const text = messages.map((m) => `${m.title}\n${m.body}\n${m.notices.map((n) => `${n.title}\n${n.body}`).join("\n")}`).join("\n");
    expect(text).toContain("Task due today");
    expect(text).toContain("Plumber due tomorrow");
    expect(text).not.toMatch(/LKR|25,000|25000|plumber/);
    for (const i of items) if (i.notice?.who) expect(i.notice.who).not.toMatch(/LKR|DEMO-\d|DEM-\d/);
  });

  it("a service's free-text type never reaches a notification: only the fixed list, anything else is \"Service\"", async () => {
    const { loaded } = await loadSources(reminderSources, { db, today: TODAY });
    const services = loaded.find((l) => l.key === "vehicle-services")!.items;
    const typed = services.find((i) => i.title.startsWith("Chain job"))!;
    expect(typed.notice?.what).toBe("Service");
    expect(services.find((i) => i.title.startsWith("oil CHANGE"))!.notice?.what).toBe("Oil change");
    for (const i of services) expect(appConfig.vehicles.serviceTypes.filter((t) => t !== "Other").concat("Service")).toContain(i.notice?.what);

    const text = previewUpcoming(services, TODAY, new Set(), 15)
      .flatMap((d) => d.messages)
      .map((m) => `${m.title}\n${m.body}`)
      .join("\n");
    expect(text).toContain("Service due today");
    expect(text).not.toMatch(/Chain|LKR|9,000|Silva/);
  });
});
