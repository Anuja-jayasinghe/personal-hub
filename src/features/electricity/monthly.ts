/**
 * Units per month for the usage chart (Phase 2.4b). Pure: no database, no clock. Amounts are
 * hundredths of a kWh. A bill's units count in the month of its reading date (the day the meter
 * was read), so one bill is one block in one month; two bills of the same meter in one month add up.
 */

import { addMonths, monthOf } from "@/lib/dates";

export type BillUnits = { meterId: string; /** "YYYY-MM-DD" */ readingDate: string; /** Hundredths of a kWh. */ units: number };

export type MonthBar = {
  /** "YYYY-MM" */
  month: string;
  /** Hundredths of a kWh, all meters. */
  total: number;
  /** One entry per meter that has units this month, in the order of `meterIds`. */
  segments: { meterId: string; units: number }[];
};

export { addMonths, monthOf };

/**
 * Bars for the last `maxMonths` months that end at the latest bill (so the chart does not need a
 * clock), starting no earlier than the first bill. Months with no bill are kept as empty bars so
 * gaps are visible. Meters not listed in `meterIds` are ignored. Empty when there are no bills.
 */
export function unitsByMonth(bills: readonly BillUnits[], meterIds: readonly string[], maxMonths = 12): MonthBar[] {
  const wanted = new Set(meterIds);
  const counted = bills.filter((b) => wanted.has(b.meterId));
  if (counted.length === 0) return [];

  const months = counted.map((b) => monthOf(b.readingDate)).sort();
  const last = months[months.length - 1];
  const first = months[0] > addMonths(last, -(maxMonths - 1)) ? months[0] : addMonths(last, -(maxMonths - 1));

  const bars: MonthBar[] = [];
  for (let month = first; month <= last; month = addMonths(month, 1)) {
    const segments = meterIds
      .map((meterId) => ({
        meterId,
        units: counted.filter((b) => b.meterId === meterId && monthOf(b.readingDate) === month).reduce((s, b) => s + b.units, 0),
      }))
      .filter((s) => s.units > 0);
    bars.push({ month, total: segments.reduce((s, x) => s + x.units, 0), segments });
  }
  return bars;
}
