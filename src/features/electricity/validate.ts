import { isValidDate } from "@/lib/dates";

/** Validation for meters and readings. Pure (plain strings in, plain values out), so it is testable. */

const clean = (v: string | undefined) => (v ?? "").trim().replace(/\s+/g, " ");

export type MeterFields = { name: string; accountNumber: string | null; notes: string | null };
export type MeterResult = { ok: true; value: MeterFields } | { ok: false; error: string };

export function parseMeter(raw: Record<string, string | undefined>): MeterResult {
  const name = clean(raw.name);
  if (!name) return { ok: false, error: "Meter name is required." };
  if (name.length > 60) return { ok: false, error: "Meter name must be at most 60 characters." };
  const accountNumber = clean(raw.accountNumber);
  if (accountNumber.length > 40) return { ok: false, error: "Account number must be at most 40 characters." };
  const notes = (raw.notes ?? "").trim();
  if (notes.length > 500) return { ok: false, error: "Notes must be at most 500 characters." };
  return { ok: true, value: { name, accountNumber: accountNumber || null, notes: notes || null } };
}

export type ReadingFields = {
  readingDate: string;
  /** kWh as a decimal string with up to 2 decimals. */
  value: string;
  note: string | null;
  /** Set when the entry records a meter replacement: the old meter's final reading. */
  replacedFinalValue: string | null;
};
export type ReadingResult = { ok: true; value: ReadingFields } | { ok: false; error: string };

function kwh(raw: string | undefined): string | null {
  const v = (raw ?? "").replace(/,/g, "").trim();
  return /^\d{1,10}(\.\d{1,2})?$/.test(v) ? v : null;
}

export function parseReading(raw: Record<string, string | undefined>): ReadingResult {
  const readingDate = (raw.readingDate ?? "").trim();
  if (!readingDate) return { ok: false, error: "Reading date is required." };
  if (!isValidDate(readingDate)) return { ok: false, error: "Reading date must be a valid date." };

  const value = kwh(raw.value);
  if (value === null) return { ok: false, error: "Reading must be a number like 12345 or 12345.6 (kWh)." };

  let replacedFinalValue: string | null = null;
  if (raw.replaced === "on" || raw.replaced === "true") {
    replacedFinalValue = kwh(raw.replacedFinalValue);
    if (replacedFinalValue === null) {
      return { ok: false, error: "For a replaced meter, enter the old meter's final reading as a number (kWh)." };
    }
  }

  const note = (raw.note ?? "").trim();
  if (note.length > 500) return { ok: false, error: "Note must be at most 500 characters." };

  return { ok: true, value: { readingDate, value, note: note || null, replacedFinalValue } };
}
