import { daysBetween } from "@/lib/dates";
import { sortReadings, usageFrom, type Reading } from "./usage";

/**
 * "Usage since your last bill" (Phase 2.3, DECISIONS C52 to C55). Pure: no database, no clock.
 * Units only, no cost (tariff estimates are deferred, C22). All amounts are hundredths of a kWh.
 *
 * The baseline is the latest bill's current reading on its reading date. Usage is then every
 * reading after that date, stepping across any "meter replaced" entries (see `usageFrom`).
 */

export type BillMark = {
  billDate: string;
  readingDate: string;
  /** The bill's current reading, in hundredths of a kWh. */
  currentReading: number;
  createdAt: Date;
};

export type SinceLastBill =
  | { state: "no-bill" }
  | { state: "no-reading"; sinceDate: string }
  | {
      state: "ok";
      /** Reading date of the last bill: where the count starts. */
      sinceDate: string;
      /** Date of the newest reading: where the count ends. */
      asOf: string;
      /** Hundredths of a kWh used between the two. */
      units: number;
      days: number;
      /** Hundredths of a kWh per day. Null only if the two dates were the same day (cannot happen: only later readings count). */
      dailyAverage: number | null;
      /** Daily average over `cycleDays`, in hundredths of a kWh; null when there is no daily average. */
      projected: number | null;
    };

/** The most recent bill: by reading date, then bill date, then the order entered. */
export function latestBill<T extends BillMark>(bills: readonly T[]): T | undefined {
  return [...bills].sort(
    (a, b) =>
      b.readingDate.localeCompare(a.readingDate) ||
      b.billDate.localeCompare(a.billDate) ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  )[0];
}

/** What one meter has used since its last bill, and what a full billing cycle at that pace would be. */
export function sinceLastBill(bills: readonly BillMark[], readings: readonly Reading[], cycleDays: number): SinceLastBill {
  const bill = latestBill(bills);
  if (!bill) return { state: "no-bill" };

  const after = sortReadings(readings.filter((r) => r.date > bill.readingDate));
  const newest = after.at(-1);
  if (!newest) return { state: "no-reading", sinceDate: bill.readingDate };

  const units = usageFrom(bill.currentReading, after);
  const days = daysBetween(bill.readingDate, newest.date);
  return {
    state: "ok",
    sinceDate: bill.readingDate,
    asOf: newest.date,
    units,
    days,
    dailyAverage: days > 0 ? Math.round(units / days) : null,
    projected: days > 0 ? Math.round((units * cycleDays) / days) : null,
  };
}

export type Combined = {
  /** How many meters had a usable figure, out of how many were counted. */
  counted: number;
  of: number;
  units: number;
  dailyAverage: number;
  projected: number;
};

/** Adds up the meters that have a figure (units, daily average and projection are all additive). Null when none do. */
export function combineUsage(results: readonly SinceLastBill[]): Combined | null {
  const ok = results.filter((r): r is Extract<SinceLastBill, { state: "ok" }> => r.state === "ok");
  if (ok.length === 0) return null;
  return {
    counted: ok.length,
    of: results.length,
    units: ok.reduce((s, r) => s + r.units, 0),
    dailyAverage: ok.reduce((s, r) => s + (r.dailyAverage ?? 0), 0),
    projected: ok.reduce((s, r) => s + (r.projected ?? 0), 0),
  };
}
