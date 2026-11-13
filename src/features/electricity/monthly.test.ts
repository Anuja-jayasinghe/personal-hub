import { describe, expect, it } from "vitest";
import { addMonths, monthOf, unitsByMonth, type BillUnits } from "./monthly";

const bill = (meterId: string, readingDate: string, kwh: number): BillUnits => ({ meterId, readingDate, units: Math.round(kwh * 100) });

describe("monthOf / addMonths", () => {
  it("takes the month and steps across year ends", () => {
    expect(monthOf("2026-11-13")).toBe("2026-11");
    expect(addMonths("2026-11", 1)).toBe("2026-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2027-01", -1)).toBe("2026-12");
    expect(addMonths("2026-03", -12)).toBe("2025-03");
    expect(addMonths("2026-03", 0)).toBe("2026-03");
  });
});

describe("unitsByMonth", () => {
  it("is empty without bills, or without bills of the listed meters", () => {
    expect(unitsByMonth([], ["a"])).toEqual([]);
    expect(unitsByMonth([bill("b", "2026-10-04", 100)], ["a"])).toEqual([]);
  });

  it("makes one bar per month from the first bill to the last, keeping empty months", () => {
    const bars = unitsByMonth([bill("a", "2026-08-30", 100), bill("a", "2026-10-30", 120)], ["a"]);
    expect(bars.map((b) => b.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(bars.map((b) => b.total)).toEqual([10000, 0, 12000]);
    expect(bars[1].segments).toEqual([]);
  });

  it("stacks meters in the given order and adds bills of one meter in one month", () => {
    const bars = unitsByMonth(
      [bill("b", "2026-10-02", 50), bill("a", "2026-10-04", 100), bill("a", "2026-10-28", 20.5)],
      ["a", "b"],
    );
    expect(bars).toEqual([
      {
        month: "2026-10",
        total: 17050,
        segments: [
          { meterId: "a", units: 12050 },
          { meterId: "b", units: 5000 },
        ],
      },
    ]);
  });

  it("keeps only the last 12 months, ending at the latest bill", () => {
    const bars = unitsByMonth([bill("a", "2025-01-10", 1), bill("a", "2026-11-10", 2)], ["a"]);
    expect(bars).toHaveLength(12);
    expect(bars[0].month).toBe("2025-12");
    expect(bars[11].month).toBe("2026-11");
    expect(bars.every((b) => b.month >= "2025-12")).toBe(true);
    expect(bars.reduce((s, b) => s + b.total, 0)).toBe(200); // the January 2025 bill is out of range
  });

  it("can show a shorter window", () => {
    const bars = unitsByMonth([bill("a", "2026-06-10", 1), bill("a", "2026-11-10", 2)], ["a"], 3);
    expect(bars.map((b) => b.month)).toEqual(["2026-09", "2026-10", "2026-11"]);
  });
});
