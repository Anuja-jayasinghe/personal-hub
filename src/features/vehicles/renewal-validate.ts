import { daysBetween, isValidDate } from "@/lib/dates";

/**
 * Validation for a renewal record. Pure (plain strings in, plain values out) like the other
 * validators, so it is easy to test. `expiryAfter` is used by the "renewed" action: the new
 * record must expire after the one it replaces.
 */

export type RenewalFields = {
  type: string;
  provider: string | null;
  referenceNumber: string | null;
  startDate: string | null;
  expiryDate: string;
  /** Decimal string with up to 2 decimals, e.g. "85000.50". */
  amount: string | null;
  /** An emission test's odometer on the test day (issue #181); always null for other types. */
  odometerKm: number | null;
};

/** Renewal types whose certificate prints the odometer: the emission test. */
export function carriesOdometer(type: string): boolean {
  return /^emission/i.test(type.trim());
}

export type RenewalResult = { ok: true; value: RenewalFields } | { ok: false; error: string };

const clean = (v: string | undefined) => (v ?? "").trim().replace(/\s+/g, " ");

export function parseRenewal(
  raw: Record<string, string | undefined>,
  allowedTypes: readonly string[],
  options: { expiryAfter?: string } = {},
): RenewalResult {
  const type = clean(raw.type);
  if (!type) return { ok: false, error: "Renewal type is required." };
  if (!allowedTypes.includes(type)) return { ok: false, error: "Renewal type is not one of the listed options." };

  const provider = clean(raw.provider);
  if (provider.length > 100) return { ok: false, error: "Provider must be at most 100 characters." };
  const referenceNumber = clean(raw.referenceNumber);
  if (referenceNumber.length > 60) return { ok: false, error: "Reference number must be at most 60 characters." };

  const expiryDate = (raw.expiryDate ?? "").trim();
  if (!expiryDate) return { ok: false, error: "Expiry date is required." };
  if (!isValidDate(expiryDate)) return { ok: false, error: "Expiry date must be a valid date." };
  if (options.expiryAfter && daysBetween(options.expiryAfter, expiryDate) <= 0) {
    return { ok: false, error: "The new expiry date must be after the one it replaces." };
  }

  const startRaw = (raw.startDate ?? "").trim();
  let startDate: string | null = null;
  if (startRaw) {
    if (!isValidDate(startRaw)) return { ok: false, error: "Start date must be a valid date." };
    if (daysBetween(startRaw, expiryDate) < 0) return { ok: false, error: "Start date cannot be after the expiry date." };
    startDate = startRaw;
  }

  const amountRaw = (raw.amount ?? "").replace(/,/g, "").trim();
  let amount: string | null = null;
  if (amountRaw) {
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(amountRaw)) return { ok: false, error: "Amount must be a number like 85000 or 85000.50." };
    amount = amountRaw;
  }

  // The odometer printed on an emission certificate, read on the test day (the start date).
  let odometerKm: number | null = null;
  const odoRaw = (raw.odometerKm ?? "").replace(/[,\s]/g, "");
  if (odoRaw && carriesOdometer(type)) {
    if (!/^\d{1,7}$/.test(odoRaw)) return { ok: false, error: "Odometer must be a whole number of km, like 42959." };
    if (!startDate) return { ok: false, error: "Add the test day (start date) for the odometer reading." };
    odometerKm = Number(odoRaw);
  }

  return { ok: true, value: { type, provider: provider || null, referenceNumber: referenceNumber || null, startDate, expiryDate, amount, odometerKm } };
}
