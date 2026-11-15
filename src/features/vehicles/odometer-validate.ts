import { isValidDate } from "@/lib/dates";
import { ODOMETER_MAX } from "./validate";

/** Validation for an odometer reading. Pure (plain strings in, plain values out), so it is testable. */

export type OdometerFields = { readingDate: string; km: number; note: string | null };
export type OdometerResult = { ok: true; value: OdometerFields } | { ok: false; error: string };

/** `today` is "YYYY-MM-DD" in the app time zone: a reading cannot be dated after it. */
export function parseOdometerReading(raw: Record<string, string | undefined>, today: string): OdometerResult {
  const readingDate = (raw.readingDate ?? "").trim();
  if (!readingDate) return { ok: false, error: "Reading date is required." };
  if (!isValidDate(readingDate)) return { ok: false, error: "Reading date must be a valid date." };
  if (readingDate > today) return { ok: false, error: "A reading cannot be dated in the future." };

  const kmRaw = (raw.km ?? "").replace(/[,\s]/g, "");
  if (!kmRaw) return { ok: false, error: "The odometer reading is required." };
  if (!/^\d+$/.test(kmRaw)) return { ok: false, error: "The odometer reading must be a whole number of km." };
  const km = Number(kmRaw);
  if (km > ODOMETER_MAX) return { ok: false, error: `The odometer reading must be at most ${ODOMETER_MAX}.` };

  const note = (raw.note ?? "").trim();
  if (note.length > 200) return { ok: false, error: "Note must be at most 200 characters." };
  return { ok: true, value: { readingDate, km, note: note || null } };
}
