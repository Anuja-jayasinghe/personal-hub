import { addMonthsToDate } from "@/lib/dates";
import { toCents } from "@/lib/decimal";
import { parseService, type ServiceFields } from "./service-validate";

/**
 * Rules for which service records matter, and yearly cost totals. Pure (no database, no clock),
 * so they can be tested. Used by the Services tab and by the reminder source.
 */

export type ServiceRow = {
  id: string;
  vehicleId: string;
  /** "YYYY-MM-DD" */
  serviceDate: string;
  serviceType: string;
  /** "YYYY-MM-DD" or null */
  nextDueDate: string | null;
  createdAt: Date;
};

/** Types are compared ignoring case and extra spaces: "Oil  change" and "oil change" are one cycle. */
export const typeKey = (type: string) => type.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * The key of a service's cycle: its vehicle and its type. The types listed in `sharedCycle` (the oil-change
 * types, V.1b) share ONE cycle per vehicle, so a Full service and an Oil change replace each other's marker;
 * every other type keeps a cycle of its own.
 */
function cycleKey(row: ServiceRow, sharedCycle: readonly string[]): string {
  const key = typeKey(row.serviceType);
  const shared = key !== "" && sharedCycle.some((t) => typeKey(t) === key);
  return `${row.vehicleId}::${shared ? "\u0000shared" : key}`;
}

/**
 * The latest record of each (vehicle, service type): the newest service date wins, and the most
 * recently entered record breaks a tie on the same day. An older record of a type is "superseded"
 * once a newer one exists, whatever the newer one's next due date says. The types in `sharedCycle` (the
 * oil-change types) count as one type: the newest service among them decides.
 */
export function latestPerType<T extends ServiceRow>(rows: readonly T[], sharedCycle: readonly string[] = []): T[] {
  const best = new Map<string, T>();
  for (const row of rows) {
    const key = cycleKey(row, sharedCycle);
    const current = best.get(key);
    if (
      !current ||
      row.serviceDate > current.serviceDate ||
      (row.serviceDate === current.serviceDate && row.createdAt > current.createdAt)
    ) {
      best.set(key, row);
    }
  }
  return [...best.values()];
}

/** The records that should remind: the latest of each type (the oil-change types as one), if it has a next due date. */
export function dueServices<T extends ServiceRow>(rows: readonly T[], sharedCycle: readonly string[] = []): (T & { nextDueDate: string })[] {
  return latestPerType(rows, sharedCycle).filter((r): r is T & { nextDueDate: string } => r.nextDueDate !== null);
}

export { toCents };

// ---------------------------------------------------------------------------------------------
// The oil-change marker (V.1a, C147)
// ---------------------------------------------------------------------------------------------

/** The part of the rules the marker needs (HubRules has it). The km is only shown beside the date; nothing reminds by km (C24). */
export type OilRules = { oilChangeMonths: number; oilChangeKm: number; oilChangeTypes: readonly string[] };

/** True when a service of this type sets the next-oil-change marker (case and spacing do not matter, like `typeKey`). */
export function isOilChangeType(serviceType: string, rules: Pick<OilRules, "oilChangeTypes">): boolean {
  const key = typeKey(serviceType);
  return key !== "" && rules.oilChangeTypes.some((t) => typeKey(t) === key);
}

/**
 * The next-oil-change date for a service: its date plus `oilChangeMonths` months (clamped to the month's end,
 * so 31 Aug + 6 months is 28 Feb), when its type is one that sets the marker; null for any other type. Calendar
 * days only. Null too when the date is not a real day, so a half-typed form never throws.
 */
export function oilChangeMarker(serviceDate: string, serviceType: string, rules: Pick<OilRules, "oilChangeMonths" | "oilChangeTypes">): string | null {
  if (!isOilChangeType(serviceType, rules)) return null;
  try {
    return addMonthsToDate(serviceDate, rules.oilChangeMonths);
  } catch {
    return null;
  }
}

const withCommas = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** "6 months after this service, or 2,500 km", from the rules in force. */
export function oilChangeWords(rules: Pick<OilRules, "oilChangeMonths" | "oilChangeKm">): string {
  const m = rules.oilChangeMonths;
  return `${m} ${m === 1 ? "month" : "months"} after this service, or ${withCommas(rules.oilChangeKm)} km`;
}

/**
 * The next due date to store for a service being created (the server does this itself, never trusting the form
 * alone). A type that sets the marker: the date the person gave wins, otherwise the marker, and with the
 * "remind me" switch off no date at all. Any other type keeps what was typed in the "next due" field.
 */
export function nextDueToStore(
  fields: { serviceDate: string; serviceType: string; nextDueDate: string | null },
  remind: boolean,
  rules: Pick<OilRules, "oilChangeMonths" | "oilChangeTypes">,
): string | null {
  if (!isOilChangeType(fields.serviceType, rules)) return fields.nextDueDate;
  if (!remind) return null;
  return fields.nextDueDate ?? oilChangeMarker(fields.serviceDate, fields.serviceType, rules);
}

/**
 * A service as it is stored, from the raw form fields (V.1a, V.1b): validated, with its next due date worked out by
 * `nextDueToStore`. The Add a service form and the one flow for papers both use it, so the marker is decided in one
 * place and never trusted from the form alone.
 */
export function serviceToStore(
  raw: Record<string, string | undefined>,
  remind: boolean,
  rules: Pick<OilRules, "oilChangeMonths" | "oilChangeTypes">,
): { ok: true; value: ServiceFields } | { ok: false; error: string } {
  const parsed = parseService(raw);
  if (!parsed.ok) return parsed;
  return { ok: true, value: { ...parsed.value, nextDueDate: nextDueToStore(parsed.value, remind, rules) } };
}
