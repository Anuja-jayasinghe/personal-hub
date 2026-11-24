import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "@/features/settings/rules";
import { buildOverviewModel } from "./overview-model";
import type { OverviewReading, OverviewRenewal, OverviewService } from "./overview";
import type { PaperCan } from "./paper-flow";

/**
 * The sparse states of the Overview (V.4, C151): a vehicle with nothing, only a book, only a service, only readings,
 * and what a see-only person gets. The model is what the page draws from, so these are the page's decisions: which bar
 * speaks, which sections exist (none is ever an empty box), whether the checklist shows. Made-up rows only.
 */

const TODAY = "2026-11-24";
const BOTH: PaperCan = { records: true, files: true };
const SEE_ONLY: PaperCan = { records: false, files: false };

const renewal = (over: Partial<OverviewRenewal> = {}): OverviewRenewal => ({
  id: "r1",
  vehicleId: "v1",
  type: "Revenue license",
  provider: null,
  startDate: "2026-02-01",
  expiryDate: "2027-01-31",
  amount: null,
  renewedAt: null,
  createdAt: new Date("2026-02-01T00:00:00Z"),
  ...over,
});
const service = (over: Partial<OverviewService> = {}): OverviewService => ({
  id: "s1",
  vehicleId: "v1",
  serviceDate: "2026-10-01",
  serviceType: "Tyres",
  garage: null,
  odometerKm: null,
  cost: null,
  nextDueDate: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  ...over,
});
const reading = (): OverviewReading => ({ id: "o1", readingDate: "2026-11-20", km: 41_000, createdAt: new Date("2026-11-20T00:00:00Z") });

const model = (over: Partial<Parameters<typeof buildOverviewModel>[0]> = {}) =>
  buildOverviewModel({
    today: TODAY,
    timeZone: "Asia/Colombo",
    archived: false,
    renewals: [],
    services: [],
    readings: [],
    fitting: [],
    documentKinds: [],
    rules: DEFAULT_RULES,
    renewalLeadDays: new Map(),
    can: BOTH,
    choices: { service: true, reading: true },
    askOdometer: true,
    ...over,
  });

describe("a vehicle with nothing at all", () => {
  const m = model();
  it("is blank, shows the checklist and no bar, no cards and no empty sections", () => {
    expect(m.blank).toBe(true);
    expect(m.checklist).toMatchObject({ done: 0, total: 4 });
    expect(m.bar).toBeNull();
    expect(m.show).toEqual({ cards: false, services: false, odometer: false, timeline: false });
    expect(m.cards).toEqual([]);
  });
  it("says what can come any time from Add, with the oil-change months in force", () => {
    expect(m.footnote).toBe("A service or an odometer reading can come any time from Add. The first oil change sets the 6-month marker.");
    expect(model({ rules: { ...DEFAULT_RULES, oilChangeMonths: 4 } }).footnote).toContain("4-month marker");
  });
  it("a see-only person gets no checklist, and still no bar or empty section", () => {
    const see = model({ can: SEE_ONLY, choices: { service: false, reading: false } });
    expect(see.checklist).toBeNull();
    expect(see.footnote).toBeNull();
    expect(see.bar).toBeNull();
    expect(see.show).toEqual({ cards: false, services: false, odometer: false, timeline: false });
  });
  it("an archived vehicle has no checklist", () => {
    expect(model({ archived: true }).checklist).toBeNull();
  });
});

describe("a vehicle with only a registration book", () => {
  const m = model({ documentKinds: ["book"] });
  it("is still blank for the Overview, with the book ticked on the checklist", () => {
    expect(m.blank).toBe(true);
    expect(m.checklist?.rows.map((r) => [r.kind, r.done])).toEqual([
      ["book", true],
      ["license", false],
      ["insurance", false],
      ["emission", false],
    ]);
    expect(m.checklist).toMatchObject({ done: 1, total: 4 });
    expect(m.bar).toBeNull();
    expect(m.show.odometer).toBe(false);
  });
});

describe("a vehicle with only a service", () => {
  it("a plain service with no next-due date: no bar (nothing is watched), the Services card, the odometer card and the timeline", () => {
    const m = model({ services: [service()] });
    expect(m.blank).toBe(false);
    expect(m.bar).toBeNull(); // "All clear" would claim a check nothing was making
    expect(m.show).toEqual({ cards: true, services: true, odometer: true, timeline: true });
    expect(m.cards.map((c) => c.title)).toEqual(["Oil change"]); // the one card says the marker comes from an oil change
    expect(m.cards[0]).toMatchObject({ item: null, sub: "No oil change recorded yet" });
    expect(m.checklist).toMatchObject({ done: 0, total: 4 }); // still missing the basics
  });

  it("an oil change with a marker far off: All clear with what is next", () => {
    const m = model({ services: [service({ serviceType: "Oil change", nextDueDate: "2027-05-24" })] });
    expect(m.bar).toBe("clear");
    expect(m.attention.next).toMatchObject({ words: "the next oil change", days: 181 });
  });

  it("an oil change with its marker inside the window: Needs you, in the soon tone", () => {
    const m = model({ services: [service({ serviceType: "Oil change", nextDueDate: "2026-12-14" })] });
    expect(m.bar).toBe("needs");
    expect(m.attention.needs[0]).toMatchObject({ what: "oil", tone: "soon", days: 20 });
  });
});

describe("a vehicle with only odometer readings", () => {
  it("has the odometer and the timeline, one card about the oil change, no bar and no Services card", () => {
    const m = model({ readings: [reading()] });
    expect(m.blank).toBe(false);
    expect(m.bar).toBeNull();
    expect(m.show).toEqual({ cards: true, services: false, odometer: true, timeline: true });
    expect(m.timeline.map((t) => t.marker)).toEqual(["reading"]);
  });
});

describe("a vehicle with a renewal", () => {
  it("watches it: All clear while it is far off", () => {
    const m = model({ renewals: [renewal()] });
    expect(m.bar).toBe("clear");
    expect(m.checklist?.rows.find((r) => r.kind === "license")!.done).toBe(true);
  });

  it("an expired one still ticks the checklist, and Needs you speaks about it", () => {
    const m = model({ renewals: [renewal({ expiryDate: "2026-10-01", startDate: "2025-10-02" })] });
    expect(m.checklist?.rows.find((r) => r.kind === "license")!.done).toBe(true);
    expect(m.bar).toBe("needs");
    expect(m.attention.needs[0]).toMatchObject({ tone: "overdue" });
  });

  it("the checklist goes once the book and all three renewals are there, with no celebration", () => {
    const m = model({
      renewals: [renewal(), renewal({ id: "r2", type: "Insurance" }), renewal({ id: "r3", type: "Emission test" })],
      documentKinds: ["book"],
    });
    expect(m.checklist).toBeNull();
  });
});

describe("what a person who may only add records or only files gets", () => {
  it("records only: three rows, finished after the three renewals", () => {
    const rows = [renewal(), renewal({ id: "r2", type: "Insurance" }), renewal({ id: "r3", type: "Emission test" })];
    expect(model({ can: { records: true, files: false } }).checklist?.rows.map((r) => r.kind)).toEqual(["license", "insurance", "emission"]);
    expect(model({ can: { records: true, files: false }, renewals: rows }).checklist).toBeNull();
  });

  it("files only: four rows kept on file, and the footnote follows the Add menu (no service or reading, no line)", () => {
    const m = model({ can: { records: false, files: true }, choices: { service: false, reading: false } });
    expect(m.checklist).toMatchObject({ total: 4 });
    expect(m.footnote).toBeNull();
  });
});
