import { daysBetween } from "@/lib/dates";
import { latestBill, type BillMark } from "./since-bill";
import { sortReadings, usageFrom, type Reading } from "./usage";

/**
 * The slab rule and the cycle chart (R.3a, DESIGN.md "The slab rule", "Other number pictures"). Pure:
 * no database, no clock. All amounts are hundredths of a kWh, like the rest of the electricity code.
 */

export type CyclePoint = {
  /** "YYYY-MM-DD" of the reading (the first point is the last bill's reading date). */
  date: string;
  /** Days since the last bill's reading date. */
  day: number;
  /** Hundredths of a kWh used since the last bill, up to and including this reading. */
  used: number;
};

/**
 * Units used so far this cycle, one point per reading after the last bill, starting at zero on the
 * bill's reading date. Empty when there is no bill. Steps across a "meter replaced" entry like the
 * rest of the usage maths.
 */
export function cycleSeries(bills: readonly BillMark[], readings: readonly Reading[]): CyclePoint[] {
  const bill = latestBill(bills);
  if (!bill) return [];
  const after = sortReadings(readings.filter((r) => r.date > bill.readingDate));
  const points: CyclePoint[] = [{ date: bill.readingDate, day: 0, used: 0 }];
  after.forEach((r, i) => {
    points.push({ date: r.date, day: daysBetween(bill.readingDate, r.date), used: usageFrom(bill.currentReading, after.slice(0, i + 1)) });
  });
  return points;
}

/** A reading as the digits a meter's dial shows: whole kWh, at least five digits ("17489", "00420"). */
export function readingDigits(hundredths: number): string[] {
  const whole = Math.max(0, Math.floor(hundredths / 100));
  return String(whole).padStart(5, "0").split("");
}
