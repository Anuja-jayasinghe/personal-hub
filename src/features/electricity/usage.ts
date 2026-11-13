import { fromCents, toCents } from "@/lib/decimal";

/**
 * Meter-reading maths (Phase 2). Pure: no database, no clock. Readings are cumulative kWh totals
 * (DECISIONS C53); all arithmetic is done in whole hundredths of a kWh so sums are exact.
 *
 * A "meter replaced" entry has `replacedFinal` (the old meter's last reading) and `value` (the new
 * meter's starting value). Usage carries on across the swap: old meter up to its final reading,
 * then the new meter from its starting value.
 */

export type Reading = {
  id: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** Hundredths of a kWh. */
  value: number;
  /** Set on a "meter replaced" entry: the old meter's final reading, in hundredths. */
  replacedFinal: number | null;
  createdAt: Date;
};

/** Converts a stored row (decimal strings) into a Reading. */
export function toReading(row: {
  id: string;
  readingDate: string;
  value: string;
  replacedFinalValue: string | null;
  createdAt: Date;
}): Reading {
  return {
    id: row.id,
    date: row.readingDate,
    value: toCents(row.value),
    replacedFinal: row.replacedFinalValue === null ? null : toCents(row.replacedFinalValue),
    createdAt: row.createdAt,
  };
}

/** Oldest first: by date, then by the order entered. */
export function sortReadings<T extends Pick<Reading, "date" | "createdAt">>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.getTime() - b.createdAt.getTime());
}

/**
 * kWh used from `baseline` (a reading's value) through `readingsAfter` (sorted, oldest first),
 * stepping across any "meter replaced" entries. Returns hundredths of a kWh.
 */
export function usageFrom(baseline: number, readingsAfter: readonly Reading[]): number {
  let previous = baseline;
  let total = 0;
  for (const r of readingsAfter) {
    if (r.replacedFinal !== null) {
      total += r.replacedFinal - previous; // old meter up to its final reading
      previous = r.value; // new meter starts here
    } else {
      total += r.value - previous;
      previous = r.value;
    }
  }
  return total;
}

/** "12345.60" style text for hundredths, plus the unit. */
export function formatKwh(hundredths: number): string {
  const [whole, frac] = fromCents(hundredths).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${grouped}${frac === "00" ? "" : `.${frac}`} kWh`;
}

export type FitCheck = { ok: true } | { ok: false; error: string };

/**
 * Does a new or edited reading fit among the existing ones? `existing` must NOT include the entry
 * being edited. A normal reading may not be lower than the one before it or higher than the one
 * after it; a "meter replaced" entry may not have an old-meter final below the previous reading.
 */
export function checkReadingFits(
  existing: readonly Reading[],
  candidate: { date: string; value: number; replacedFinal: number | null; createdAt: Date },
): FitCheck {
  const sorted = sortReadings(existing);
  const before = [...sorted].reverse().find((r) => r.date <= candidate.date);
  const after = sorted.find((r) => r.date > candidate.date);

  if (candidate.replacedFinal !== null) {
    if (before && candidate.replacedFinal < before.value) {
      return { ok: false, error: `The old meter's final reading (${formatKwh(candidate.replacedFinal)}) is lower than the earlier reading of ${formatKwh(before.value)} on ${before.date}.` };
    }
  } else if (before && candidate.value < before.value) {
    return {
      ok: false,
      error: `That reading is lower than the earlier one (${formatKwh(before.value)} on ${before.date}). If the meter was replaced, tick "Meter replaced" and enter the old meter's final reading.`,
    };
  }

  if (after) {
    const ceiling = after.replacedFinal !== null ? after.replacedFinal : after.value;
    const ownEnd = candidate.value; // the value the next reading must not be below
    if (after.replacedFinal !== null) {
      if (ownEnd > ceiling) {
        return { ok: false, error: `That reading is higher than the old meter's final reading (${formatKwh(ceiling)}) recorded on ${after.date}.` };
      }
    } else if (ownEnd > after.value) {
      return { ok: false, error: `That reading is higher than the later one (${formatKwh(after.value)} on ${after.date}). Check the date.` };
    }
  }
  return { ok: true };
}
