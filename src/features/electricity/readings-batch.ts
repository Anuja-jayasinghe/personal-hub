import { isValidDate } from "@/lib/dates";
import { toCents } from "@/lib/decimal";

/**
 * Rules for entering both meters' readings in one go (2b.1). Pure (plain values in and out), so
 * they are easy to test; the server action checks each value against the database afterwards.
 */

const KWH = /^\d{1,10}(\.\d{1,2})?$/;

/** A kWh figure typed by a person ("17,489", "17489.5") as a clean decimal string, or null when it is not one. */
export function cleanKwh(raw: string | undefined): string | null {
  const v = (raw ?? "").replace(/,/g, "").trim();
  return KWH.test(v) ? v : null;
}

export type BatchEntry = { meterId: string; name: string; raw: string | undefined };
export type BatchRow = { meterId: string; name: string; value: string };
export type BatchResult = { ok: true; date: string; rows: BatchRow[] } | { ok: false; error: string };

/**
 * One date and a value per meter. A blank field means "skip this meter"; at least one meter must
 * have a value. Every filled value must be a number like 12345 or 12345.6. The error names the meter.
 */
export function parseBatch(date: string | undefined, entries: readonly BatchEntry[]): BatchResult {
  const d = (date ?? "").trim();
  if (!d) return { ok: false, error: "Reading date is required." };
  if (!isValidDate(d)) return { ok: false, error: "Reading date must be a valid date." };

  const rows: BatchRow[] = [];
  const problems: string[] = [];
  for (const e of entries) {
    if ((e.raw ?? "").trim() === "") continue;
    const value = cleanKwh(e.raw);
    if (value === null) problems.push(`${e.name}: enter a number like 12345 or 12345.6 (kWh).`);
    else rows.push({ meterId: e.meterId, name: e.name, value });
  }
  if (problems.length > 0) return { ok: false, error: problems.join("\n") };
  if (rows.length === 0) return { ok: false, error: "Enter at least one meter's reading." };
  return { ok: true, date: d, rows };
}

export type ReadingPreview =
  | { state: "empty" }
  | { state: "invalid" }
  | { state: "lower"; last: number }
  | { state: "ok"; delta: number | null };

/**
 * What to tell the person while they type: nothing, "not a number", "lower than the last reading",
 * or how much the meter has gone up since the last reading (null when there is no earlier reading).
 * `last` is the meter's last reading in hundredths of a kWh.
 */
export function previewReading(last: number | null, typed: string): ReadingPreview {
  if (typed.trim() === "") return { state: "empty" };
  const clean = cleanKwh(typed);
  if (clean === null) return { state: "invalid" };
  const value = toCents(clean);
  if (last !== null && value < last) return { state: "lower", last };
  return { state: "ok", delta: last === null ? null : value - last };
}
