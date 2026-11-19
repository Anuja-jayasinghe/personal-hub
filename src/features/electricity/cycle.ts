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

export type SlabScale = {
  /** The top of the line, in hundredths: the high slab is drawn at 90% of it. */
  max: number;
  /** Positions along the line, 0 to 100. */
  usedPct: number;
  lowPct: number;
  highPct: number;
  /** Where the cycle ends at this pace, capped at the end of the line; null when there is no pace. */
  projectedPct: number | null;
  /** True when the pace runs past the end of the line (the label then reads "…→"). */
  projectedBeyond: boolean;
};

/**
 * Where everything sits on a slab rule. The line runs from 0 to a little past the high slab, so 120
 * and 180 always land in the same places (60% and 90% with the usual numbers), whatever a meter has used.
 */
export function slabScale(input: { used: number; projected: number | null; low: number; high: number }): SlabScale {
  const max = input.high / 0.9;
  const pct = (v: number) => Math.min(100, Math.max(0, (v / max) * 100));
  const projected = input.projected !== null && input.projected > input.used ? input.projected : null;
  return {
    max,
    usedPct: pct(input.used),
    lowPct: pct(input.low),
    highPct: pct(input.high),
    projectedPct: projected === null ? null : pct(projected),
    projectedBeyond: projected !== null && projected > max,
  };
}

/** A reading as the digits a meter's dial shows: whole kWh, at least five digits ("17489", "00420"). */
export function readingDigits(hundredths: number): string[] {
  const whole = Math.max(0, Math.floor(hundredths / 100));
  return String(whole).padStart(5, "0").split("");
}
