import { describe, expect, it } from "vitest";
import { combineUsage, latestBill, sinceLastBill, type BillMark } from "./since-bill";
import type { Reading } from "./usage";

let n = 0;
const reading = (date: string, kwh: number, replacedFinalKwh: number | null = null): Reading => ({
  id: `r${++n}`,
  date,
  value: Math.round(kwh * 100),
  replacedFinal: replacedFinalKwh === null ? null : Math.round(replacedFinalKwh * 100),
  createdAt: new Date(2026, 0, 1, 0, 0, n),
});
const bill = (billDate: string, readingDate: string, currentKwh: number, createdAt = new Date(2026, 0, 1)): BillMark => ({
  billDate,
  readingDate,
  currentReading: Math.round(currentKwh * 100),
  createdAt,
});

describe("latestBill", () => {
  it("picks the newest by reading date, then bill date, then entry order", () => {
    const a = bill("2026-09-05", "2026-09-04", 100);
    const b = bill("2026-10-05", "2026-10-04", 200);
    expect(latestBill([a, b])).toBe(b);
    expect(latestBill([b, a])).toBe(b);
    const c = bill("2026-10-06", "2026-10-04", 200);
    expect(latestBill([b, c])).toBe(c);
    const d = bill("2026-10-06", "2026-10-04", 200, new Date(2026, 5, 1));
    expect(latestBill([c, d])).toBe(d);
    expect(latestBill([])).toBeUndefined();
  });
});

describe("sinceLastBill", () => {
  it("has no figure without a bill", () => {
    expect(sinceLastBill([], [reading("2026-11-01", 5)], 30)).toEqual({ state: "no-bill" });
  });

  it("waits for a reading after the last bill's reading date", () => {
    const bills = [bill("2026-10-05", "2026-10-04", 1000)];
    expect(sinceLastBill(bills, [], 30)).toEqual({ state: "no-reading", sinceDate: "2026-10-04" });
    // readings on or before the bill's reading date do not count
    expect(sinceLastBill(bills, [reading("2026-10-04", 1000), reading("2026-09-01", 900)], 30)).toEqual({
      state: "no-reading",
      sinceDate: "2026-10-04",
    });
  });

  it("works out units, days, daily average and a projected cycle from the newest reading", () => {
    const bills = [bill("2026-09-05", "2026-09-04", 900), bill("2026-10-05", "2026-10-04", 1000)];
    const readings = [reading("2026-10-04", 1000), reading("2026-10-14", 1050), reading("2026-10-24", 1110)];
    expect(sinceLastBill(bills, readings, 30)).toEqual({
      state: "ok",
      sinceDate: "2026-10-04",
      asOf: "2026-10-24",
      units: 11000, // 110 kWh
      days: 20,
      dailyAverage: 550, // 5.5 kWh/day
      projected: 16500, // 165 kWh over 30 days
    });
  });

  it("sorts the readings itself", () => {
    const bills = [bill("2026-10-05", "2026-10-04", 1000)];
    const r = sinceLastBill(bills, [reading("2026-10-24", 1110), reading("2026-10-14", 1050)], 30);
    expect(r).toMatchObject({ state: "ok", asOf: "2026-10-24", units: 11000 });
  });

  it("carries on across a replaced meter", () => {
    const bills = [bill("2026-10-05", "2026-10-04", 1000)];
    const readings = [
      reading("2026-10-14", 1050),
      reading("2026-10-20", 0, 1080), // old meter ended at 1080, new one starts at 0
      reading("2026-10-30", 40),
    ];
    // 50 + 30 (to 1080) + 40 = 120 kWh over 26 days
    expect(sinceLastBill(bills, readings, 30)).toMatchObject({ units: 12000, days: 26 });
  });

  it("handles a one-day gap", () => {
    const bills = [bill("2026-10-05", "2026-10-04", 1000)];
    expect(sinceLastBill(bills, [reading("2026-10-05", 1007)], 30)).toMatchObject({ days: 1, dailyAverage: 700, projected: 21000 });
  });

  it("rounds the daily average and projection to whole hundredths", () => {
    const bills = [bill("2026-10-01", "2026-10-01", 0)];
    const r = sinceLastBill(bills, [reading("2026-10-04", 10)], 30); // 10 kWh in 3 days
    expect(r).toMatchObject({ units: 1000, days: 3, dailyAverage: 333, projected: 10000 });
  });
});

describe("combineUsage", () => {
  it("adds up the meters that have a figure and counts them", () => {
    const bills = [bill("2026-10-05", "2026-10-04", 1000)];
    const a = sinceLastBill(bills, [reading("2026-10-14", 1050)], 30); // 50 kWh in 10 days
    const b = sinceLastBill(bills, [reading("2026-10-24", 1100)], 30); // 100 kWh in 20 days
    const none = sinceLastBill([], [], 30);
    expect(combineUsage([a, b, none])).toEqual({ counted: 2, of: 3, units: 15000, dailyAverage: 1000, projected: 30000 });
  });

  it("is null when no meter has a figure", () => {
    expect(combineUsage([{ state: "no-bill" }, { state: "no-reading", sinceDate: "2026-10-04" }])).toBeNull();
    expect(combineUsage([])).toBeNull();
  });
});
