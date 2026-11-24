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

// ---------------------------------------------------------------------------------------------
// Where a new record of a kind belongs in the history (V.1b, C148)
// ---------------------------------------------------------------------------------------------

/** As much of a renewal as placing a new one needs. */
export type PlacedRow = {
  id: string;
  type: string;
  startDate: string | null;
  expiryDate: string;
  renewedAt: Date | null;
  createdAt: Date;
};

/**
 * What saving a new renewal does to the records of the same vehicle and type:
 *  - `twin`: a record ending the same day exists. Nothing new is made (it is either given the file or refused).
 *  - `current`: the new one ends after every record, so it becomes the current one and the unrenewed ones before
 *    it are renewed, as Renew does (C46). `renewedOn` is the new start day (the day it takes over), or null
 *    when the new record has no start date: then they are renewed "now", the existing behaviour of Renew.
 *  - `history`: an older paper is being added. It is stored as already renewed, `renewedOn` being the start of
 *    the next later record of the type (the way the import scripts did it), or null (now) when that one has no start day.
 * Rows of other types are ignored; the type match ignores case and spacing, like everywhere else.
 */
export type Placement<T extends PlacedRow> =
  | { kind: "twin"; twins: T[] }
  | { kind: "current"; renew: T[]; renewedOn: string | null }
  | { kind: "history"; renewedOn: string | null };

export function placeRenewal<T extends PlacedRow>(rows: readonly T[], incoming: { type: string; startDate: string | null; expiryDate: string }): Placement<T> {
  const same = rows.filter((r) => typeKey(r.type) === typeKey(incoming.type));
  const twins = same.filter((r) => r.expiryDate === incoming.expiryDate);
  if (twins.length > 0) return { kind: "twin", twins };
  const later = same.filter((r) => r.expiryDate > incoming.expiryDate).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.createdAt.getTime() - b.createdAt.getTime());
  if (later.length > 0) return { kind: "history", renewedOn: later[0].startDate };
  return { kind: "current", renew: same.filter((r) => r.renewedAt === null), renewedOn: incoming.startDate };
}

/** The moment a record is marked renewed: 09:00 UTC on the calendar day (the same day in the app time zone), or now when there is no day. */
export function renewedMoment(day: string | null, now: Date = new Date()): Date {
  return day ? new Date(`${day}T09:00:00Z`) : now;
}
