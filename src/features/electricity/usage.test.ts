import { describe, expect, it } from "vitest";
import { checkReadingFits, formatKwh, sortReadings, usageFrom, type Reading } from "./usage";

let n = 0;
const r = (date: string, kwh: number, replacedFinal: number | null = null): Reading => {
  n++;
  return { id: `r${n}`, date, value: Math.round(kwh * 100), replacedFinal: replacedFinal === null ? null : Math.round(replacedFinal * 100), createdAt: new Date(2026, 0, 1, 0, 0, n) };
};
const cand = (date: string, kwh: number, replacedFinal: number | null = null) => ({
  date,
  value: Math.round(kwh * 100),
  replacedFinal: replacedFinal === null ? null : Math.round(replacedFinal * 100),
  createdAt: new Date(),
});

describe("usageFrom", () => {
  it("is the difference to the latest reading", () => {
    expect(usageFrom(1000_00, [r("2026-11-05", 1100), r("2026-11-12", 1214.5)])).toBe(214_50);
  });

  it("is zero with no readings after the baseline", () => {
    expect(usageFrom(1000_00, [])).toBe(0);
  });

  it("carries on across a meter replacement", () => {
    // Old meter ran 1000 -> 1050 (final), new meter starts at 0 and reaches 30: 50 + 30 = 80 kWh.
    expect(usageFrom(1000_00, [r("2026-11-05", 0, 1050), r("2026-11-12", 30)])).toBe(80_00);
  });

  it("handles a replacement as the only entry", () => {
    expect(usageFrom(1000_00, [r("2026-11-05", 2, 1040)])).toBe(40_00);
  });

  it("sums exactly (no floating-point drift)", () => {
    // 0.30 - 0.10 = 0.20 kWh exactly (floating point would give 0.19999999999999998).
    expect(usageFrom(10, [r("2026-11-01", 0.2), r("2026-11-02", 0.3)])).toBe(20);
  });
});

describe("formatKwh", () => {
  it("groups thousands and drops a zero fraction", () => {
    expect(formatKwh(123456_00)).toBe("123,456 kWh");
    expect(formatKwh(214_50)).toBe("214.50 kWh");
    expect(formatKwh(0)).toBe("0 kWh");
  });
});

describe("sortReadings", () => {
  it("orders by date, then by entry order", () => {
    const a = r("2026-11-05", 1), b = r("2026-11-05", 2), c = r("2026-11-01", 0);
    expect(sortReadings([b, a, c]).map((x) => x.id)).toEqual([c.id, a.id, b.id]);
  });
});

describe("checkReadingFits", () => {
  const existing = [r("2026-10-01", 1000), r("2026-11-01", 1200)];

  it("accepts a reading after the latest that is not lower", () => {
    expect(checkReadingFits(existing, cand("2026-11-10", 1300)).ok).toBe(true);
    expect(checkReadingFits(existing, cand("2026-11-10", 1200)).ok).toBe(true); // same value is fine
  });

  it("refuses a reading lower than the previous one and explains replacement", () => {
    const res = checkReadingFits(existing, cand("2026-11-10", 1100));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Meter replaced/);
  });

  it("accepts the first reading of a meter", () => {
    expect(checkReadingFits([], cand("2026-11-10", 5)).ok).toBe(true);
  });

  it("checks a reading inserted between two others", () => {
    expect(checkReadingFits(existing, cand("2026-10-15", 1100)).ok).toBe(true);
    expect(checkReadingFits(existing, cand("2026-10-15", 1300)).ok).toBe(false); // above the later one
    expect(checkReadingFits(existing, cand("2026-10-15", 900)).ok).toBe(false); // below the earlier one
  });

  it("accepts a replacement whose old-meter final is not below the previous reading", () => {
    expect(checkReadingFits(existing, cand("2026-11-10", 0, 1250)).ok).toBe(true);
    expect(checkReadingFits(existing, cand("2026-11-10", 0, 1150)).ok).toBe(false);
  });

  it("a later replacement caps how high an earlier reading can be", () => {
    const withReplacement = [r("2026-10-01", 1000), r("2026-11-20", 0, 1250)];
    expect(checkReadingFits(withReplacement, cand("2026-11-05", 1240)).ok).toBe(true);
    expect(checkReadingFits(withReplacement, cand("2026-11-05", 1260)).ok).toBe(false);
  });
});
