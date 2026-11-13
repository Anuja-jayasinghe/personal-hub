import { daysBetween, isValidDate } from "@/lib/dates";

/**
 * Validation for a service record. Pure (plain strings in, plain values out), like validate.ts,
 * so it is easy to test. The server action feeds it the form fields.
 */

export type ServiceFields = {
  serviceDate: string;
  serviceType: string;
  garage: string | null;
  odometerKm: number | null;
  /** Decimal string with up to 2 decimals, e.g. "12500.50". */
  cost: string | null;
  itemsDone: string | null;
  nextDueDate: string | null;
};

export type ServiceResult = { ok: true; value: ServiceFields } | { ok: false; error: string };

const clean = (v: string | undefined) => (v ?? "").trim().replace(/\s+/g, " ");

export function parseService(raw: Record<string, string | undefined>): ServiceResult {
  const serviceDate = (raw.serviceDate ?? "").trim();
  if (!serviceDate) return { ok: false, error: "Service date is required." };
  if (!isValidDate(serviceDate)) return { ok: false, error: "Service date must be a valid date." };

  const serviceType = clean(raw.serviceType);
  if (!serviceType) return { ok: false, error: "Service type is required." };
  if (serviceType.length > 60) return { ok: false, error: "Service type must be at most 60 characters." };

  const garage = clean(raw.garage);
  if (garage.length > 100) return { ok: false, error: "Garage must be at most 100 characters." };

  // Free text for items done keeps its line breaks, only trimmed.
  const itemsDone = (raw.itemsDone ?? "").trim();
  if (itemsDone.length > 5000) return { ok: false, error: "Items done must be at most 5000 characters." };

  const odometerRaw = (raw.odometerKm ?? "").replace(/[,\s]/g, "");
  let odometerKm: number | null = null;
  if (odometerRaw) {
    if (!/^\d+$/.test(odometerRaw)) return { ok: false, error: "Odometer must be a whole number." };
    odometerKm = Number(odometerRaw);
    if (odometerKm > 9_999_999) return { ok: false, error: "Odometer must be at most 9999999." };
  }

  const costRaw = (raw.cost ?? "").replace(/,/g, "").trim();
  let cost: string | null = null;
  if (costRaw) {
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(costRaw)) return { ok: false, error: "Cost must be a number like 12500 or 12500.50." };
    cost = costRaw;
  }

  const nextRaw = (raw.nextDueDate ?? "").trim();
  let nextDueDate: string | null = null;
  if (nextRaw) {
    if (!isValidDate(nextRaw)) return { ok: false, error: "Next due date must be a valid date." };
    if (daysBetween(serviceDate, nextRaw) < 0) {
      return { ok: false, error: "Next due date cannot be before the service date." };
    }
    nextDueDate = nextRaw;
  }

  return { ok: true, value: { serviceDate, serviceType, garage: garage || null, odometerKm, cost, itemsDone: itemsDone || null, nextDueDate } };
}
