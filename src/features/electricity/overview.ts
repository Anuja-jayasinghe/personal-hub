import { fromCents, toCents } from "@/lib/decimal";
import { sortReadings, usageFrom, type Reading } from "./usage";

/**
 * Small pure helpers for the Electricity page (C78): what to call each meter in a badge, how to
 * split a kWh figure into a big number and a unit, how much each reading went up, and how much is
 * still to pay. No database, no clock, so they are easy to test.
 */

/**
 * The letter shown in a meter's badge: a single trailing letter or digit of the name ("Meter A" is
 * "A", "Meter 2" is "2"), otherwise the first letter ("Main house" is "M"). "?" for an empty name.
 */
export function badgeLetter(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const last = trimmed.match(/(?:^|\s)([A-Za-z0-9])$/);
  return (last ? last[1] : trimmed[0]).toUpperCase();
}

/** A figure in hundredths of a kWh as a big number and a unit: 8700 gives "87" and "kWh". */
export function kwhParts(hundredths: number): { value: string; unit: string } {
  const [whole, frac] = fromCents(hundredths).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return { value: frac === "00" ? grouped : `${grouped}.${frac}`, unit: "kWh" };
}

export type ReadingRow = {
  id: string;
  date: string;
  /** Hundredths of a kWh. */
  value: number;
  /** Hundredths of a kWh used since the reading before it; null for the oldest reading. */
  delta: number | null;
  replaced: boolean;
};

/** Readings newest first, each with how much it went up since the one before (stepping across a replaced meter). */
export function readingRows(readings: readonly Reading[]): ReadingRow[] {
  const sorted = sortReadings(readings);
  const rows = sorted.map((r, i) => ({
    id: r.id,
    date: r.date,
    value: r.value,
    delta: i === 0 ? null : usageFrom(sorted[i - 1].value, [r]),
    replaced: r.replacedFinal !== null,
  }));
  return rows.reverse();
}

/**
 * What is still to pay: the amounts of the bills with no paid date, in hundredths of a currency
 * unit, plus how many unpaid bills have no amount (they are not in the total).
 */
export function unpaidTotal(bills: readonly { amount: string | null; paidDate: string | null }[]): { cents: number; withoutAmount: number } {
  let cents = 0;
  let withoutAmount = 0;
  for (const b of bills) {
    if (b.paidDate) continue;
    if (b.amount === null) withoutAmount++;
    else cents += toCents(b.amount);
  }
  return { cents, withoutAmount };
}

/**
 * Widths for the usage gauge, as percentages of its track. `used` is what the meter has used since
 * the last bill, `reference` what the last bill itself billed, `projected` the usage a full
 * billing cycle would reach at the current pace. All in hundredths of a kWh. The scale is the
 * largest of the three plus a little room, so the bar never fills the track edge to edge.
 */
export function gaugeScale(input: { used: number; reference: number | null; projected: number | null }): {
  usedPct: number;
  projectedPct: number;
  referencePct: number | null;
} {
  const used = Math.max(0, input.used);
  const reference = input.reference === null ? null : Math.max(0, input.reference);
  const projected = input.projected === null ? null : Math.max(used, input.projected);
  const top = Math.max(used, reference ?? 0, projected ?? 0) * 1.08;
  if (top <= 0) return { usedPct: 0, projectedPct: 0, referencePct: reference === null ? null : 0 };
  const pct = (v: number) => Math.min(100, Math.round((v / top) * 1000) / 10);
  return {
    usedPct: pct(used),
    projectedPct: projected === null ? pct(used) : pct(projected),
    referencePct: reference === null ? null : pct(reference),
  };
}

/** The widest bar share for a row of figures, so a list of bills or readings can draw small comparable bars. 0 when there is nothing to draw. */
export function barShare(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.min(100, Math.max(2, Math.round((value / max) * 100)));
}
