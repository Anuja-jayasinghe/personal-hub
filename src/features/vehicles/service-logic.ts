import { toCents } from "@/lib/decimal";

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
 * The latest record of each (vehicle, service type): the newest service date wins, and the most
 * recently entered record breaks a tie on the same day. An older record of a type is "superseded"
 * once a newer one exists, whatever the newer one's next due date says.
 */
export function latestPerType<T extends ServiceRow>(rows: readonly T[]): T[] {
  const best = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.vehicleId}::${typeKey(row.serviceType)}`;
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

/** The records that should remind: the latest of each type, if it has a next due date. */
export function dueServices<T extends ServiceRow>(rows: readonly T[]): (T & { nextDueDate: string })[] {
  return latestPerType(rows).filter((r): r is T & { nextDueDate: string } => r.nextDueDate !== null);
}

export { toCents };

/** Total spent per calendar year of the service date, newest year first. */
export function totalsByYear(rows: readonly { serviceDate: string; cost: string | null }[]): { year: number; cents: number }[] {
  const totals = new Map<number, number>();
  for (const r of rows) {
    if (r.cost === null) continue;
    const year = Number(r.serviceDate.slice(0, 4));
    totals.set(year, (totals.get(year) ?? 0) + toCents(r.cost));
  }
  return [...totals.entries()].map(([year, cents]) => ({ year, cents })).sort((a, b) => b.year - a.year);
}
