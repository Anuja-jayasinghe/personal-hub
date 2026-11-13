import { daysBetween, isValidDate } from "@/lib/dates";
import { defaultUnits } from "./bill-logic";

/** Validation for a bill. Pure (plain strings in, plain values out), so it is testable. */

export type BillFields = {
  billDate: string;
  readingDate: string;
  previousReading: string;
  currentReading: string;
  units: string;
  amount: string | null;
  dueDate: string | null;
  paidDate: string | null;
  notes: string | null;
};
export type BillResult = { ok: true; value: BillFields } | { ok: false; error: string };

function decimal(raw: string | undefined): string | null {
  const v = (raw ?? "").replace(/,/g, "").trim();
  return /^\d{1,10}(\.\d{1,2})?$/.test(v) ? v : null;
}

export function parseBill(raw: Record<string, string | undefined>): BillResult {
  const billDate = (raw.billDate ?? "").trim();
  if (!billDate) return { ok: false, error: "Bill date is required." };
  if (!isValidDate(billDate)) return { ok: false, error: "Bill date must be a valid date." };

  const readingDate = (raw.readingDate ?? "").trim() || billDate; // the reading is usually taken on or near the bill date
  if (!isValidDate(readingDate)) return { ok: false, error: "Reading date must be a valid date." };

  const previousReading = decimal(raw.previousReading);
  if (previousReading === null) return { ok: false, error: "Previous reading must be a number like 12345 or 12345.6 (kWh)." };
  const currentReading = decimal(raw.currentReading);
  if (currentReading === null) return { ok: false, error: "Current reading must be a number like 12345 or 12345.6 (kWh)." };

  // Units: what the bill says, or current minus previous when left empty. If the current reading
  // is below the previous one (a replaced meter), the units must be typed in.
  let units = decimal(raw.units);
  if ((raw.units ?? "").trim() && units === null) return { ok: false, error: "Units must be a number like 214 or 214.5 (kWh)." };
  if (units === null) {
    units = defaultUnits(previousReading, currentReading);
    if (units === null) {
      return { ok: false, error: "The current reading is lower than the previous one. If the meter was replaced, type the units shown on the bill." };
    }
  }

  const amountRaw = (raw.amount ?? "").trim();
  let amount: string | null = null;
  if (amountRaw) {
    amount = decimal(amountRaw);
    if (amount === null) return { ok: false, error: "Amount must be a number like 4850 or 4850.50." };
  }

  const dueRaw = (raw.dueDate ?? "").trim();
  let dueDate: string | null = null;
  if (dueRaw) {
    if (!isValidDate(dueRaw)) return { ok: false, error: "Due date must be a valid date." };
    if (daysBetween(billDate, dueRaw) < 0) return { ok: false, error: "Due date cannot be before the bill date." };
    dueDate = dueRaw;
  }

  const paidRaw = (raw.paidDate ?? "").trim();
  let paidDate: string | null = null;
  if (paidRaw) {
    if (!isValidDate(paidRaw)) return { ok: false, error: "Paid date must be a valid date." };
    paidDate = paidRaw;
  }

  const notes = (raw.notes ?? "").trim();
  if (notes.length > 500) return { ok: false, error: "Notes must be at most 500 characters." };

  return {
    ok: true,
    value: { billDate, readingDate, previousReading, currentReading, units, amount, dueDate, paidDate, notes: notes || null },
  };
}
