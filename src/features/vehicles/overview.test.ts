import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { accessFromGrants } from "@/features/people/access";
import { toPoints, unfitKeys, pointKey } from "./odometer";
import {
  TIMELINE_FIRST,
  buildTimeline,
  glanceCards,
  isBlank,
  itemHref,
  kmDrivenSince,
  kmGlanceWords,
  needsYou,
  nextUpWords,
  oilState,
  pageOf,
  parseItem,
  pickItem,
  sheetAccess,
  type OverviewReading,
  type OverviewRenewal,
  type OverviewRules,
  type OverviewService,
} from "./overview";

/** The Overview's rules, with made-up numbers only. */
const TODAY = "2026-11-24";
const V = "00000000-0000-4000-8000-0000000000a1";
const rules: OverviewRules = { leadDays: [30, 14, 7, 1, 0], oilChangeMonths: 6, oilChangeKm: 2500, oilChangeTypes: ["Oil change", "Full service"] };
const noLeads = new Map<string, readonly number[] | undefined>();
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let n = 100;

const renewal = (type: string, expiresIn: number, over: Partial<OverviewRenewal> = {}): OverviewRenewal => ({
  id: uuid(++n),
  vehicleId: V,
  type,
  provider: null,
  startDate: addDays(TODAY, expiresIn - 365),
  expiryDate: addDays(TODAY, expiresIn),
  amount: null,
  renewedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
});
const service = (serviceType: string, ago: number, over: Partial<OverviewService> = {}): OverviewService => ({
  id: uuid(++n),
  vehicleId: V,
  serviceDate: addDays(TODAY, -ago),
  serviceType,
  garage: null,
  odometerKm: null,
  cost: null,
  nextDueDate: null,
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, n)),
  ...over,
});
const reading = (daysAgo: number, km: number): OverviewReading => ({ id: uuid(++n), readingDate: addDays(TODAY, -daysAgo), km, createdAt: new Date("2026-01-01T00:00:00Z") });

const fittingOf = (readings: OverviewReading[], services: OverviewService[]) => {
  const points = toPoints(
    readings.map((r) => ({ ...r, note: null })),
    services,
  );
  const unfit = unfitKeys(points);
  return points.filter((p) => !unfit.has(pointKey(p)));
};

describe("the ?item= address", () => {
  const r = renewal("Insurance", 100);
  const s = service("Oil change", 10);
  const other = uuid(999);

  it("opens a renewal or a service of this vehicle", () => {
    expect(pickItem(`renewal:${r.id}`, [r], [s])).toEqual({ kind: "renewal", row: r });
    expect(pickItem(`service:${s.id}`, [r], [s])).toEqual({ kind: "service", row: s });
  });
  it("ignores another vehicle's id, an id of the other kind and a deleted record, without saying why", () => {
    expect(pickItem(`renewal:${other}`, [r], [s])).toBeNull();
    expect(pickItem(`service:${r.id}`, [r], [s])).toBeNull(); // wrong type
    expect(pickItem(`renewal:${s.id}`, [r], [s])).toBeNull();
    expect(pickItem(`renewal:${r.id}`, [], [])).toBeNull();
  });
  it("ignores anything malformed", () => {
    for (const bad of [undefined, "", "renewal", "renewal:", "renewal:not-a-uuid", `other:${r.id}`, `${r.id}`, `renewal:${r.id}x`, ` renewal:${r.id}`, `renewal:${r.id}&x=1`, "service:1 or 1=1", ["renewal:" + r.id, "x"]]) {
      expect(parseItem(bad as string)).toBeNull();
      expect(pickItem(bad as string, [r], [s])).toBeNull();
    }
  });
  it("builds the address a link uses", () => {
    expect(itemHref("/vehicles/cab-1234", { kind: "renewal", id: r.id })).toBe(`/vehicles/cab-1234?item=renewal:${r.id}`);
  });
});

describe("what a person may do in a sheet", () => {
  const person = (...g: [string, string][]) => accessFromGrants(g.map(([area, level]) => ({ area, level })));
  it("an owner may do everything", () => {
    expect(sheetAccess({ owner: true })).toEqual({ canEdit: true, canSeeFiles: true, canAddFile: true, canEditFiles: true });
  });
  it("see-only in Vehicles: read-only, and no files without Vehicle documents", () => {
    expect(sheetAccess(person(["vehicles", "see"]))).toEqual({ canEdit: false, canSeeFiles: false, canAddFile: false, canEditFiles: false });
  });
  it("files follow Vehicle documents, never Vehicles", () => {
    expect(sheetAccess(person(["vehicles", "edit"]))).toMatchObject({ canEdit: true, canSeeFiles: false });
    expect(sheetAccess(person(["vehicles", "see"], ["vehicle_documents", "see"]))).toEqual({ canEdit: false, canSeeFiles: true, canAddFile: false, canEditFiles: false });
    expect(sheetAccess(person(["vehicles", "see"], ["vehicle_documents", "add"]))).toMatchObject({ canSeeFiles: true, canAddFile: true, canEditFiles: false });
    expect(sheetAccess(person(["vehicles", "see"], ["vehicle_documents", "edit"]))).toMatchObject({ canEditFiles: true });
  });
});

describe("km driven since a service (a glance only)", () => {
  it("is the newest odometer value minus the service's own", () => {
    const s = service("Oil change", 60, { odometerKm: 31_200 });
    expect(kmDrivenSince(fittingOf([reading(30, 32_000), reading(4, 33_020)], [s]), s)).toBe(1_820);
  });
  it("is hidden when nothing newer was read", () => {
    const s = service("Oil change", 5, { odometerKm: 31_200 });
    expect(kmDrivenSince(fittingOf([], [s]), s)).toBeNull();
  });
  it("never counts a reading from before the service", () => {
    const s = service("Oil change", 5, { odometerKm: 31_200 });
    expect(kmDrivenSince(fittingOf([reading(40, 30_000)], [s]), s)).toBeNull();
  });
  it("is hidden when the service has no odometer, or its value does not fit", () => {
    const none = service("Oil change", 60);
    expect(kmDrivenSince(fittingOf([reading(4, 33_020)], [none]), none)).toBeNull();
    const typo = service("Oil change", 60, { odometerKm: 1_000_000 });
    expect(kmDrivenSince(fittingOf([reading(100, 30_000), reading(4, 33_020)], [typo]), typo)).toBeNull();
  });
  it("counts a newer service's odometer as a reading too", () => {
    const a = service("Oil change", 90, { odometerKm: 30_000 });
    const b = service("Tyres", 10, { odometerKm: 31_000 });
    expect(kmDrivenSince(fittingOf([], [a, b]), a)).toBe(1_000);
  });
  it("words", () => expect(kmGlanceWords({ driven: 1820, of: 2500 })).toBe("1,820 of 2,500 km"));
});

describe("the oil-change marker", () => {
  it("none recorded", () => expect(oilState([service("Tyres", 5)], rules, TODAY, [])).toEqual({ has: false }));
  it("is decided by the newest service among the oil-change types (one cycle)", () => {
    const old = service("Oil change", 200, { nextDueDate: addDays(TODAY, -20) });
    const newer = service("Full service", 10, { nextDueDate: addDays(TODAY, 170) });
    const state = oilState([old, newer], rules, TODAY, []);
    expect(state).toMatchObject({ has: true, serviceId: newer.id, days: 170, km: null });
  });
  it("carries the km of the newest oil-change service only", () => {
    const old = service("Oil change", 200, { odometerKm: 20_000, nextDueDate: addDays(TODAY, -20) });
    const newer = service("Oil change", 10, { odometerKm: 31_200, nextDueDate: addDays(TODAY, 170) });
    const state = oilState([old, newer], rules, TODAY, fittingOf([reading(2, 32_000)], [old, newer]));
    expect(state).toMatchObject({ has: true, serviceId: newer.id, km: { driven: 800, of: 2500 } });
  });
  it("has no days with no marker (remind me off)", () => {
    expect(oilState([service("Oil change", 10)], rules, TODAY, [])).toMatchObject({ has: true, markerDate: null, days: null });
  });
});

describe("Needs you", () => {
  const input = (over: Partial<Parameters<typeof needsYou>[0]> = {}) => {
    const renewals = over.renewals ?? [];
    const services = over.services ?? [];
    return needsYou({ today: TODAY, renewals, services, rules, renewalLeadDays: noLeads, oil: oilState(services, rules, TODAY, []), ...over });
  };

  it("is empty with nothing recorded and says nothing is coming", () => {
    expect(input()).toEqual({ needs: [], next: null });
  });
  it("lists a renewal inside its window and an overdue one, most urgent first", () => {
    const soon = renewal("Insurance", 20);
    const late = renewal("Revenue license", -3);
    const far = renewal("Emission test", 200);
    const r = input({ renewals: [soon, far, late] });
    expect(r.needs.map((x) => x.item.id)).toEqual([late.id, soon.id]);
    expect(r.needs[0]).toMatchObject({ days: -3, tone: "overdue", detail: "3 days late" });
    expect(r.needs[1]).toMatchObject({ days: 20, tone: "soon", detail: "20 days left" });
    expect(r.next).toBeNull();
  });
  it("uses a renewal type's own lead days", () => {
    const r = renewal("Insurance", 45);
    expect(input({ renewals: [r] }).needs).toHaveLength(0);
    expect(input({ renewals: [r], renewalLeadDays: new Map([["Insurance", [60, 30]]]) }).needs).toHaveLength(1);
  });
  it("ignores a renewal that has been renewed: only the current one counts", () => {
    const old = renewal("Insurance", -10, { renewedAt: new Date("2026-11-01T00:00:00Z") });
    const current = renewal("Insurance", 300);
    const r = input({ renewals: [old, current] });
    expect(r.needs).toHaveLength(0);
    expect(r.next).toMatchObject({ days: 300 });
  });
  it("a type with no record at all is not needing anything", () => {
    expect(input({ renewals: [renewal("Insurance", 200)] }).needs).toHaveLength(0);
  });
  it("shows the oil-change marker inside its window with the km glance", () => {
    const s = service("Oil change", 160, { odometerKm: 31_200, nextDueDate: addDays(TODAY, 20) });
    const fitting = fittingOf([reading(4, 33_020)], [s]);
    const r = input({ services: [s], oil: oilState([s], rules, TODAY, fitting) });
    expect(r.needs).toHaveLength(1);
    expect(r.needs[0]).toMatchObject({ what: "oil", days: 20, tone: "soon", title: "Oil change by 14 Dec", detail: "20 days left, or 2,500 km (1,820 driven)" });
  });
  it("shows the oil card's words without km when none can be told", () => {
    const s = service("Oil change", 160, { nextDueDate: addDays(TODAY, 5) });
    expect(input({ services: [s] }).needs[0]).toMatchObject({ detail: "5 days left, or 2,500 km", tone: "overdue" });
  });
  it("an oil change that is overdue", () => {
    const s = service("Oil change", 200, { nextDueDate: addDays(TODAY, -6) });
    expect(input({ services: [s] }).needs[0]).toMatchObject({ title: "Oil change was due 18 Nov", detail: "6 days late, or 2,500 km", tone: "overdue" });
  });
  it("a newer oil change with a far marker silences an older late one", () => {
    const old = service("Oil change", 300, { nextDueDate: addDays(TODAY, -100) });
    const newer = service("Full service", 5, { nextDueDate: addDays(TODAY, 175) });
    const r = input({ services: [old, newer] });
    expect(r.needs).toHaveLength(0);
    expect(r.next).toMatchObject({ days: 175, words: "the next oil change" });
  });
  it("a newer oil change with the reminder off silences the old one", () => {
    const old = service("Oil change", 300, { nextDueDate: addDays(TODAY, -100) });
    const newer = service("Oil change", 5);
    expect(input({ services: [old, newer] })).toEqual({ needs: [], next: null });
  });
  it("mixes oil, a renewal and another service in one list, soonest first", () => {
    const oil = service("Oil change", 160, { nextDueDate: addDays(TODAY, 12) });
    const tyres = service("Tyres", 100, { nextDueDate: addDays(TODAY, 1) });
    const lic = renewal("Revenue license", 25);
    const ins = renewal("Insurance", -2);
    const r = input({ services: [oil, tyres], renewals: [lic, ins] });
    expect(r.needs.map((x) => [x.what, x.days])).toEqual([["renewal", -2], ["service", 1], ["oil", 12], ["renewal", 25]]);
    expect(r.needs[1].title).toBe("Tyres due 25 Nov");
  });
  it("all clear says what is next, soonest first", () => {
    const r = input({ renewals: [renewal("Emission test", 292), renewal("Revenue license", 268)] });
    expect(r.needs).toHaveLength(0);
    expect(r.next).toEqual({ words: "the revenue license", days: 268 });
    expect(nextUpWords(r.next!)).toBe("Next up: the revenue license, in 268 days.");
  });
  it("a day left is singular", () => expect(nextUpWords({ words: "the insurance", days: 1 })).toBe("Next up: the insurance, in 1 day."));
});

describe("the cards", () => {
  const cards = (renewals: OverviewRenewal[], services: OverviewService[] = [], fitting: ReturnType<typeof fittingOf> = []) =>
    glanceCards({ today: TODAY, renewals, oil: oilState(services, rules, TODAY, fitting), hasAnyRecord: renewals.length + services.length > 0 });

  it("come soonest first, late ones before everything", () => {
    const s = service("Oil change", 160, { nextDueDate: addDays(TODAY, 20) });
    const list = cards([renewal("Insurance", 143), renewal("Revenue license", 303), renewal("Emission test", -4)], [s]);
    expect(list.map((c) => c.title)).toEqual(["Emission test", "Oil change", "Insurance", "Revenue license"]);
  });
  it("name the days for a screen reader", () => {
    const list = cards([renewal("Revenue license", 268), renewal("Insurance", 1), renewal("Emission test", -3), renewal("Other", 0)]);
    expect(list.filter((c) => c.item).map((c) => c.label)).toEqual(["Emission test, 3 days late", "Other, ends today", "Insurance, 1 day left", "Revenue license, 268 days left"]);
  });
  it("the ring is green over 30 days, amber inside 30, red inside 7 or late", () => {
    const list = cards([renewal("A", 268), renewal("B", 30), renewal("C", 31), renewal("D", 7), renewal("E", 8), renewal("F", -1)]);
    const tone = Object.fromEntries(list.filter((c) => c.item).map((c) => [c.title, c.tone]));
    expect(tone).toEqual({ A: "ok", B: "soon", C: "ok", D: "overdue", E: "soon", F: "overdue" });
  });
  it("show only the current renewal of a type, and no card for a type with no record", () => {
    const old = renewal("Insurance", -10, { renewedAt: new Date("2026-11-01T00:00:00Z") });
    const list = cards([old, renewal("Insurance", 300)]);
    expect(list.filter((c) => c.title === "Insurance")).toHaveLength(1);
    expect(list.some((c) => c.title === "Revenue license")).toBe(false);
  });
  it("the oil card shows days, the date and the km glance with a bar", () => {
    const s = service("Oil change", 160, { odometerKm: 31_200, nextDueDate: addDays(TODAY, 20) });
    const [oil] = cards([], [s], fittingOf([reading(4, 33_020)], [s]));
    expect(oil).toMatchObject({ title: "Oil change", days: 20, tone: "soon", dateLine: `By ${formatDate(addDays(TODAY, 20))}`, km: { driven: 1820, of: 2500 } });
    expect(oil.km!.share).toBeCloseTo(0.728, 2);
    expect(oil.label).toBe("Oil change, 20 days left");
  });
  it("the oil card's bar never overflows when the km is passed", () => {
    const s = service("Oil change", 160, { odometerKm: 30_000, nextDueDate: addDays(TODAY, 20) });
    const [oil] = cards([], [s], fittingOf([reading(4, 33_020)], [s]));
    expect(oil.km).toMatchObject({ driven: 3020, share: 1 });
  });
  it("the oil card hides the km part with no readings after the service", () => {
    const s = service("Oil change", 160, { odometerKm: 31_200, nextDueDate: addDays(TODAY, 20) });
    expect(cards([], [s], fittingOf([], [s]))[0].km).toBeNull();
  });
  it("says so when no oil change is recorded, last of all and without a link", () => {
    const list = cards([renewal("Insurance", 100)]);
    expect(list.at(-1)).toMatchObject({ title: "Oil change", item: null, sub: "No oil change recorded yet", days: null });
  });
  it("no oil card at all for a vehicle with nothing recorded", () => expect(cards([])).toEqual([]));
  it("an oil change with the reminder off has no ring and says so", () => {
    const [oil] = cards([], [service("Oil change", 10)]);
    expect(oil).toMatchObject({ days: null, tone: null, sub: "No reminder set", label: "Oil change, no reminder set" });
  });
});

describe("the timeline", () => {
  const entries = () => {
    const s = service("Oil change", 163, { odometerKm: 31_200, garage: "Test Garage" });
    const early = renewal("Insurance", 100, { startDate: addDays(TODAY, -265), expiryDate: addDays(TODAY, 100) });
    const first = renewal("Insurance", -265, { startDate: addDays(TODAY, -630), expiryDate: addDays(TODAY, -265), renewedAt: new Date("2025-03-01T00:00:00Z") });
    return { s, early, first, list: buildTimeline({ today: TODAY, timeZone: "Asia/Colombo", renewals: [first, early], services: [s], readings: [reading(4, 33_020), reading(400, 20_000)] }) };
  };

  it("merges services, renewals and readings, newest first", () => {
    const { list } = entries();
    expect(list.map((e) => e.key.split(":")[0])).toEqual(["reading", "service", "renewal", "reading", "renewal"]);
    expect([...list].sort((a, b) => b.date.localeCompare(a.date)).map((e) => e.key)).toEqual(list.map((e) => e.key));
  });
  it("says what each one is; a reading opens nothing", () => {
    const { list, s, early, first } = entries();
    expect(list.find((e) => e.key === `renewal:${early.id}`)).toMatchObject({ title: "Insurance renewed", marker: "paper" });
    expect(list.find((e) => e.key === `renewal:${first.id}`)).toMatchObject({ title: "Insurance added" });
    expect(list.find((e) => e.key === `service:${s.id}`)).toMatchObject({ marker: "service", detail: "31,200 km · Test Garage", item: { kind: "service", id: s.id } });
    const r = list.find((e) => e.marker === "reading")!;
    expect(r).toMatchObject({ title: "Odometer reading", detail: "33,020 km", item: null });
  });
  it("labels a day with its year only when it is not this year", () => {
    const { list } = entries();
    expect(list.find((e) => e.date === addDays(TODAY, -4))!.dateLabel).toBe("20 Nov");
    expect(list.find((e) => e.date === addDays(TODAY, -400))!.dateLabel).toMatch(/2025$/);
  });
  it("dates a renewal with no start by the day it was entered", () => {
    const r = renewal("Revenue license", 100, { startDate: null, createdAt: new Date("2026-05-10T20:00:00Z") });
    const [e] = buildTimeline({ today: TODAY, timeZone: "Asia/Colombo", renewals: [r], services: [], readings: [] });
    expect(e.date).toBe("2026-05-11"); // 01:30 the next morning in Colombo
  });
  it("breaks a tie on the same day by the one entered last", () => {
    const a = { ...reading(3, 100), createdAt: new Date("2026-11-21T01:00:00Z") };
    const b = { ...reading(3, 200), createdAt: new Date("2026-11-21T02:00:00Z") };
    const list = buildTimeline({ today: TODAY, timeZone: "Asia/Colombo", renewals: [], services: [], readings: [a, b] });
    expect(list.map((e) => e.detail)).toEqual(["200 km", "100 km"]);
  });
  it("shows five at first, and Show more reveals the rest", () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ k: i }));
    expect(pageOf(many, TIMELINE_FIRST)).toMatchObject({ hidden: 9 });
    expect(pageOf(many, TIMELINE_FIRST).visible).toHaveLength(5);
    expect(pageOf(many, 15)).toEqual({ visible: many, hidden: 0 });
    expect(pageOf([], 5)).toEqual({ visible: [], hidden: 0 });
  });
});

describe("a vehicle with nothing recorded", () => {
  it("is blank only with no renewal, service or reading", () => {
    expect(isBlank({ renewals: [], services: [], readings: [] })).toBe(true);
    expect(isBlank({ renewals: [], services: [], readings: [1] })).toBe(false);
  });
});
