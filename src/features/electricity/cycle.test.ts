import { describe, expect, it } from "vitest";
import { cycleSeries, readingDigits } from "./cycle";
import type { BillMark } from "./since-bill";
import type { Reading } from "./usage";

let n = 0;
const reading = (date: string, kwh: number, replacedFinalKwh: number | null = null): Reading => ({
  id: `r${++n}`,
  date,
  value: Math.round(kwh * 100),
  replacedFinal: replacedFinalKwh === null ? null : Math.round(replacedFinalKwh * 100),
  createdAt: new Date(2026, 0, 1, 0, 0, n),
});
const bill = (readingDate: string, currentKwh: number): BillMark => ({
  billDate: readingDate,
  readingDate,
  currentReading: Math.round(currentKwh * 100),
  createdAt: new Date(2026, 0, 1),
});

describe("cycleSeries", () => {
  it("is empty without a bill", () => {
    expect(cycleSeries([], [reading("2026-11-10", 100)])).toEqual([]);
  });

  it("starts at zero on the bill and adds up each reading after it", () => {
    const pts = cycleSeries([bill("2026-11-06", 37342)], [reading("2026-11-01", 37300), reading("2026-11-10", 37375), reading("2026-11-18", 37429)]);
    expect(pts).toEqual([
      { date: "2026-11-06", day: 0, used: 0 },
      { date: "2026-11-10", day: 4, used: 3300 },
      { date: "2026-11-18", day: 12, used: 8700 },
    ]);
  });

  it("counts from the latest bill and steps across a replaced meter", () => {
    const pts = cycleSeries(
      [bill("2026-10-06", 37200), bill("2026-11-06", 37342)],
      [reading("2026-11-08", 37352), reading("2026-11-12", 5, 37360)],
    );
    expect(pts.map((p) => p.used)).toEqual([0, 1000, 1800]);
  });
});

describe("readingDigits", () => {
  it("shows whole kWh as at least five digits", () => {
    expect(readingDigits(1748950)).toEqual(["1", "7", "4", "8", "9"]);
    expect(readingDigits(42000)).toEqual(["0", "0", "4", "2", "0"]);
    expect(readingDigits(12345600)).toEqual(["1", "2", "3", "4", "5", "6"]);
  });
});
