import { describe, expect, it } from "vitest";
import { checkFits, latestPoint, toPoints, withDistances, type OdometerPoint } from "./odometer";
import { parseOdometerReading } from "./odometer-validate";

let n = 0;
const reading = (readingDate: string, km: number, note: string | null = null) => ({ id: `r${++n}`, readingDate, km, note, createdAt: new Date(2026, 0, 1, 0, 0, n) });
const service = (serviceDate: string, odometerKm: number | null, serviceType = "Oil change") => ({ id: `s${++n}`, serviceDate, serviceType, odometerKm, createdAt: new Date(2026, 0, 1, 0, 0, n) });
const point = (date: string, km: number): OdometerPoint => ({ id: `p${++n}`, source: "reading", date, km, label: null, createdAt: new Date(2026, 0, 1, 0, 0, n) });

describe("toPoints", () => {
  it("combines readings and services that have an odometer, oldest first", () => {
    const pts = toPoints(
      [reading("2026-06-01", 50000), reading("2026-01-10", 45000, "bought")],
      [service("2026-03-15", 47000, "Full service"), service("2026-04-01", null)],
    );
    expect(pts.map((p) => [p.date, p.km, p.source, p.label])).toEqual([
      ["2026-01-10", 45000, "reading", "bought"],
      ["2026-03-15", 47000, "service", "Full service"],
      ["2026-06-01", 50000, "reading", null],
    ]);
  });
  it("is empty with nothing", () => {
    expect(toPoints([], [])).toEqual([]);
  });
});

describe("latestPoint", () => {
  it("is the value on the latest date, not the highest or the last entered", () => {
    const pts = toPoints([reading("2026-06-01", 50000), reading("2026-02-01", 46000)], [service("2026-04-01", 48000)]);
    expect(latestPoint(pts)).toMatchObject({ date: "2026-06-01", km: 50000 });
  });
  it("takes the highest km when several are on the latest day", () => {
    expect(latestPoint(toPoints([reading("2026-06-01", 50000), reading("2026-06-01", 50020)], []))?.km).toBe(50020);
  });
  it("is undefined with no points", () => {
    expect(latestPoint([])).toBeUndefined();
  });
});

describe("checkFits", () => {
  const pts = [point("2026-01-01", 40000), point("2026-06-01", 50000)];
  it("accepts a value between its neighbours, or after the last, or before the first", () => {
    expect(checkFits(pts, { date: "2026-03-01", km: 45000 })).toEqual({ ok: true });
    expect(checkFits(pts, { date: "2026-09-01", km: 50000 })).toEqual({ ok: true });
    expect(checkFits(pts, { date: "2025-12-01", km: 39000 })).toEqual({ ok: true });
  });
  it("refuses a value lower than an earlier one, saying which", () => {
    const r = checkFits(pts, { date: "2026-07-01", km: 49000 });
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.error).toMatch(/lower than the earlier value of 50,000 km on 2026-06-01/);
  });
  it("refuses a value higher than a later one", () => {
    const r = checkFits(pts, { date: "2026-03-01", km: 55000 });
    expect(r.ok === false && r.error).toMatch(/higher than the later value of 50,000 km on 2026-06-01/);
  });
  it("allows an equal value (the vehicle did not move) and same-day values", () => {
    expect(checkFits(pts, { date: "2026-07-01", km: 50000 })).toEqual({ ok: true });
    expect(checkFits(pts, { date: "2026-06-01", km: 50010 })).toEqual({ ok: true });
  });
  it("accepts anything when there is no history", () => {
    expect(checkFits([], { date: "2026-03-01", km: 1 })).toEqual({ ok: true });
  });
});

describe("withDistances", () => {
  it("adds the distance and days since the previous value", () => {
    const d = withDistances(toPoints([reading("2026-01-01", 40000), reading("2026-02-01", 41200)], [service("2026-03-03", 43000)]));
    expect(d.map((p) => [p.sinceKm, p.sinceDays])).toEqual([[null, null], [1200, 31], [1800, 30]]);
  });
});

describe("parseOdometerReading", () => {
  const TODAY = "2026-11-15";
  it("accepts a reading and tidies the number", () => {
    expect(parseOdometerReading({ readingDate: "2026-11-14", km: "84,000", note: " after trip " }, TODAY)).toEqual({
      ok: true,
      value: { readingDate: "2026-11-14", km: 84000, note: "after trip" },
    });
    expect(parseOdometerReading({ readingDate: TODAY, km: "0" }, TODAY)).toMatchObject({ ok: true });
  });
  it("refuses bad input", () => {
    expect(parseOdometerReading({ km: "1" }, TODAY)).toMatchObject({ ok: false });
    expect(parseOdometerReading({ readingDate: "2026-02-31", km: "1" }, TODAY)).toMatchObject({ ok: false });
    expect(parseOdometerReading({ readingDate: "2026-11-16", km: "1" }, TODAY)).toMatchObject({ ok: false });
    expect(parseOdometerReading({ readingDate: TODAY, km: "" }, TODAY)).toMatchObject({ ok: false });
    expect(parseOdometerReading({ readingDate: TODAY, km: "12.5" }, TODAY)).toMatchObject({ ok: false });
    expect(parseOdometerReading({ readingDate: TODAY, km: "-5" }, TODAY)).toMatchObject({ ok: false });
    expect(parseOdometerReading({ readingDate: TODAY, km: "10000000" }, TODAY)).toMatchObject({ ok: false });
    expect(parseOdometerReading({ readingDate: TODAY, km: "5", note: "x".repeat(201) }, TODAY)).toMatchObject({ ok: false });
  });
});
