import { describe, expect, it } from "vitest";
import { badgeLetter, barShare, gaugeScale, kwhParts, readingRows, unpaidTotal } from "./overview";
import type { Reading } from "./usage";

const r = (id: string, date: string, value: number, replacedFinal: number | null = null): Reading => ({
  id,
  date,
  value,
  replacedFinal,
  createdAt: new Date(`${date}T00:00:00Z`),
});

describe("badgeLetter", () => {
  it("uses a single trailing letter or digit, else the first letter", () => {
    expect(badgeLetter("Meter A")).toBe("A");
    expect(badgeLetter("meter b")).toBe("B");
    expect(badgeLetter("Meter 2")).toBe("2");
    expect(badgeLetter("Main house")).toBe("M");
    expect(badgeLetter("  Annex ")).toBe("A");
    expect(badgeLetter("")).toBe("?");
  });
});

describe("kwhParts", () => {
  it("splits a figure into a number and a unit", () => {
    expect(kwhParts(8700)).toEqual({ value: "87", unit: "kWh" });
    expect(kwhParts(0)).toEqual({ value: "0", unit: "kWh" });
    expect(kwhParts(1746550)).toEqual({ value: "17,465.50", unit: "kWh" });
  });
});

describe("readingRows", () => {
  it("lists newest first with the increase since the reading before", () => {
    const rows = readingRows([r("a", "2026-10-04", 1735800), r("b", "2026-10-27", 1746500), r("c", "2026-11-15", 1746500)]);
    expect(rows.map((x) => [x.date, x.delta])).toEqual([
      ["2026-11-15", 0],
      ["2026-10-27", 10700],
      ["2026-10-04", null],
    ]);
  });
  it("steps across a replaced meter", () => {
    const rows = readingRows([r("a", "2026-01-01", 10000), r("b", "2026-02-01", 50, 10500)]);
    expect(rows[0].delta).toBe(500); // 100.00 up to the old meter's final 105.00; the new meter's 0.50 is only its starting value
    expect(rows[0].replaced).toBe(true);
  });
  it("is empty for no readings", () => {
    expect(readingRows([])).toEqual([]);
  });
});

describe("unpaidTotal", () => {
  it("adds the unpaid amounts and counts unpaid bills without an amount", () => {
    expect(
      unpaidTotal([
        { amount: "3204.10", paidDate: null },
        { amount: "4709.74", paidDate: null },
        { amount: "2818.46", paidDate: "2026-10-23" },
        { amount: null, paidDate: null },
      ]),
    ).toEqual({ cents: 791384, withoutAmount: 1 });
  });
});

describe("gaugeScale", () => {
  it("scales used, last bill and pace to one track with a little headroom", () => {
    const g = gaugeScale({ used: 8700, reference: 14300, projected: 21750 });
    expect(g.referencePct).toBeGreaterThan(g.usedPct);
    expect(g.projectedPct).toBeGreaterThan(g.referencePct!);
    expect(g.projectedPct).toBeLessThan(100);
  });
  it("never lets the pace fall below what is already used", () => {
    expect(gaugeScale({ used: 5000, reference: null, projected: 100 }).projectedPct).toBe(gaugeScale({ used: 5000, reference: null, projected: 5000 }).projectedPct);
  });
  it("is all zero when nothing was used and there is nothing to compare", () => {
    expect(gaugeScale({ used: 0, reference: null, projected: null })).toEqual({ usedPct: 0, projectedPct: 0, referencePct: null });
    expect(gaugeScale({ used: 0, reference: 0, projected: 0 }).referencePct).toBe(0);
  });
});

describe("barShare", () => {
  it("is the share of the largest figure, never invisibly small", () => {
    expect(barShare(50, 100)).toBe(50);
    expect(barShare(100, 100)).toBe(100);
    expect(barShare(1, 1000)).toBe(2);
    expect(barShare(0, 100)).toBe(0);
    expect(barShare(5, 0)).toBe(0);
  });
});
