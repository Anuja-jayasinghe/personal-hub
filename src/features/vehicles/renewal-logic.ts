/**
 * Which renewal of a vehicle is the "current" one (DECISIONS C46). Pure, so it can be tested.
 * The current renewal of a vehicle and type is the one that has NOT been renewed and has the
 * latest expiry date. Only current renewals feed Reminders; the rest is history.
 */

export type RenewalRow = {
  id: string;
  vehicleId: string;
  type: string;
  /** "YYYY-MM-DD" */
  expiryDate: string;
  renewedAt: Date | null;
  createdAt: Date;
};

const typeKey = (type: string) => type.trim().replace(/\s+/g, " ").toLowerCase();

/** The current renewal of each (vehicle, type); ties on the expiry date go to the one entered last. */
export function currentRenewals<T extends RenewalRow>(rows: readonly T[]): T[] {
  const best = new Map<string, T>();
  for (const row of rows) {
    if (row.renewedAt !== null) continue;
    const key = `${row.vehicleId}::${typeKey(row.type)}`;
    const current = best.get(key);
    if (
      !current ||
      row.expiryDate > current.expiryDate ||
      (row.expiryDate === current.expiryDate && row.createdAt > current.createdAt)
    ) {
      best.set(key, row);
    }
  }
  return [...best.values()];
}

/** Current renewals (soonest expiry first) and past ones (newest expiry first). */
export function splitCurrentAndPast<T extends RenewalRow>(rows: readonly T[]): { current: T[]; past: T[] } {
  const current = currentRenewals(rows);
  const ids = new Set(current.map((r) => r.id));
  return {
    current: [...current].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.type.localeCompare(b.type)),
    past: rows.filter((r) => !ids.has(r.id)).sort((a, b) => b.expiryDate.localeCompare(a.expiryDate)),
  };
}
