import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/read";
import { attachments, vehicleOdometerReadings, vehicleRenewals, vehicleServices } from "@/db/schema";
import { DEMO_VEHICLES, demoRows } from "@/db/demo/data";
import { makeTestDb } from "@/test/pglite";
import { DEFAULT_RULES } from "@/features/settings/rules";
import { toPoints, unfitKeys, pointKey } from "./odometer";
import { buildTimeline, glanceCards, itemParam, needsYou, oilState, pickItem } from "./overview";
import { buildOverviewModel } from "./overview-model";
import { paperFromDocument } from "./papers";

/**
 * The new Overview over the demo's made-up vehicles in a real Postgres (PGlite): what its cards and Needs you bar
 * say for real rows, and that a record of one vehicle can never be opened through another's address.
 */
const TODAY = "2026-11-24";
let db: Db;

const load = async (vehicleId: string) => {
  const [renewals, services, readings] = await Promise.all([
    db.select().from(vehicleRenewals).where(eq(vehicleRenewals.vehicleId, vehicleId)),
    db.select().from(vehicleServices).where(eq(vehicleServices.vehicleId, vehicleId)),
    db.select().from(vehicleOdometerReadings).where(eq(vehicleOdometerReadings.vehicleId, vehicleId)),
  ]);
  const points = toPoints(readings, services, renewals.filter((r) => r.type === "Emission test"));
  const unfit = unfitKeys(points);
  const fitting = points.filter((p) => !unfit.has(pointKey(p)));
  return { renewals, services, readings, fitting };
};

beforeAll(async () => {
  ({ db } = await makeTestDb({ today: TODAY }));
  // The test database seeds the vehicles, renewals and services; the demo also has typed odometer readings.
  await db.insert(vehicleOdometerReadings).values(demoRows(TODAY).vehicleOdometerReadings);
  await db.insert(attachments).values(demoRows(TODAY).attachments);
});

/** The demo's vehicles through the same model the page draws from (V.4, C151): one for each state the new pages show. */
describe("the demo's vehicles show the new pages well", () => {
  const modelOf = async (vehicleId: string) => {
    const { renewals, services, readings, fitting } = await load(vehicleId);
    const files = await db.select().from(attachments).where(eq(attachments.ownerId, vehicleId));
    const documentKinds = files.map((a) => paperFromDocument({ id: a.id, ownerType: a.ownerType, ownerId: a.ownerId, fileName: a.fileName, title: a.title, mimeType: a.mimeType, sizeBytes: a.sizeBytes, createdAt: a.createdAt }).kind);
    return buildOverviewModel({
      today: TODAY,
      timeZone: "Asia/Colombo",
      archived: false,
      renewals,
      services,
      readings,
      fitting,
      documentKinds,
      rules: DEFAULT_RULES,
      renewalLeadDays: new Map(),
      can: { records: true, files: true },
      choices: { service: true, reading: true },
      askOdometer: true,
    });
  };

  it("the car has an amber oil-change card (due in 20 days, with its km) beside a Needs you bar", async () => {
    const m = await modelOf(DEMO_VEHICLES.car);
    const oil = m.cards.find((c) => c.title === "Oil change")!;
    expect(oil).toMatchObject({ days: 20, tone: "soon" });
    expect(oil.km).not.toBeNull();
    expect(m.bar).toBe("needs");
    expect(m.checklist).toBeNull(); // book, license, insurance and emission test all there
  });

  it("the scooter is a fresh set: every card green, All clear, nothing left to set up", async () => {
    const m = await modelOf(DEMO_VEHICLES.scooter);
    expect(m.bar).toBe("clear");
    expect(m.attention.next).not.toBeNull();
    expect(m.cards.length).toBe(4);
    expect(m.cards.every((c) => c.tone === "ok")).toBe(true);
    expect(m.cards.find((c) => c.title === "Oil change")!.km).toMatchObject({ driven: 260, of: 2_500 });
    expect(m.checklist).toBeNull();
  });

  it("the brand-new vehicle has nothing, so the Overview is the checklist", async () => {
    const m = await modelOf(DEMO_VEHICLES.newcomer);
    expect(m.blank).toBe(true);
    expect(m.checklist).toMatchObject({ done: 0, total: 4 });
    expect(m.bar).toBeNull();
    expect(m.show).toEqual({ cards: false, services: false, odometer: false, timeline: false });
  });

  it("the bike shows the partly-set-up card: only its book is missing", async () => {
    const m = await modelOf(DEMO_VEHICLES.bike);
    expect(m.checklist).toMatchObject({ done: 3, total: 4 });
    expect(m.checklist!.rows.filter((r) => !r.done).map((r) => r.kind)).toEqual(["book"]);
  });
});

describe("the Overview over the demo's vehicles", () => {
  it("shows soonest-first cards and a Needs you list for the car", async () => {
    const { renewals, services, fitting } = await load(DEMO_VEHICLES.car);
    const oil = oilState(services, DEFAULT_RULES, TODAY, fitting);
    const cards = glanceCards({ today: TODAY, renewals, oil, hasAnyRecord: true });
    const days = cards.map((c) => c.days).filter((d): d is number => d !== null);
    expect(days).toEqual([...days].sort((a, b) => a - b));
    expect(cards.length).toBeGreaterThanOrEqual(3);
    const attention = needsYou({ today: TODAY, renewals, services, rules: DEFAULT_RULES, renewalLeadDays: new Map(), oil });
    expect(attention.needs.length).toBeGreaterThan(0); // the insurance ends in 9 days
    expect(attention.needs[0].title).toContain("Insurance");
  });
  it("gives the bike an oil card with its marker", async () => {
    const { renewals, services, fitting } = await load(DEMO_VEHICLES.bike);
    const oil = oilState(services, DEFAULT_RULES, TODAY, fitting);
    expect(oil).toMatchObject({ has: true, days: 50 });
    expect(glanceCards({ today: TODAY, renewals, oil, hasAnyRecord: true }).some((c) => c.title === "Oil change" && c.days === 50)).toBe(true);
  });
  it("builds a timeline from services, renewals and readings", async () => {
    const { renewals, services, readings } = await load(DEMO_VEHICLES.car);
    const list = buildTimeline({ today: TODAY, timeZone: "Asia/Colombo", renewals, services, readings });
    expect(list.length).toBe(renewals.length + services.length + readings.length);
    expect(new Set(list.map((e) => e.marker))).toEqual(new Set(["reading", "service", "emission", "paper"]));
  });
  it("never opens another vehicle's record, whatever the address says", async () => {
    const car = await load(DEMO_VEHICLES.car);
    const bike = await load(DEMO_VEHICLES.bike);
    const carRenewal = car.renewals[0];
    const carService = car.services[0];
    // Through the car's own rows it opens...
    expect(pickItem(itemParam({ kind: "renewal", id: carRenewal.id }), car.renewals, car.services)).not.toBeNull();
    // ...through the bike's rows (the bike's page) it does not, and nor does a service address given a renewal's id.
    expect(pickItem(itemParam({ kind: "renewal", id: carRenewal.id }), bike.renewals, bike.services)).toBeNull();
    expect(pickItem(itemParam({ kind: "service", id: carService.id }), bike.renewals, bike.services)).toBeNull();
    expect(pickItem(itemParam({ kind: "service", id: carRenewal.id }), car.renewals, car.services)).toBeNull();
  });
});
