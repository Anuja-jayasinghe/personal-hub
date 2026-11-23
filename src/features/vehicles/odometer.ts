import { daysBetween } from "@/lib/dates";

/**
 * Mileage maths (dated odometer readings). Pure: no database, no clock. A "point" is one dated
 * odometer value from one of three sources, so nothing has to be entered twice: a reading typed on
 * the Odometer section, the odometer of a service record, or the test-day odometer printed on an
 * emission test certificate (issue #181).
 */

export type OdometerSource = "reading" | "service" | "emission";

export type OdometerPoint = {
  /** The row's id (a reading or a service). */
  id: string;
  source: OdometerSource;
  /** "YYYY-MM-DD" */
  date: string;
  km: number;
  /** A reading's note, a service's type ("Oil change"), or a test's centre. */
  label: string | null;
  createdAt: Date;
};

/** Oldest first: by date, then km, then the order entered. */
function byTime(a: OdometerPoint, b: OdometerPoint): number {
  return a.date.localeCompare(b.date) || a.km - b.km || a.createdAt.getTime() - b.createdAt.getTime();
}

/** Combines readings, services with an odometer and emission tests with one into one list, oldest first. */
export function toPoints(
  readings: readonly { id: string; readingDate: string; km: number; note: string | null; createdAt: Date }[],
  services: readonly { id: string; serviceDate: string; serviceType: string; odometerKm: number | null; createdAt: Date }[],
  tests: readonly { id: string; startDate: string | null; odometerKm: number | null; provider: string | null; createdAt: Date }[] = [],
): OdometerPoint[] {
  const points: OdometerPoint[] = [
    ...readings.map((r): OdometerPoint => ({ id: r.id, source: "reading", date: r.readingDate, km: r.km, label: r.note, createdAt: r.createdAt })),
    ...services.flatMap((s): OdometerPoint[] =>
      s.odometerKm === null ? [] : [{ id: s.id, source: "service", date: s.serviceDate, km: s.odometerKm, label: s.serviceType, createdAt: s.createdAt }],
    ),
    // An emission test is dated on its test day (the start date); without one it cannot be placed.
    ...tests.flatMap((t): OdometerPoint[] =>
      t.odometerKm === null || !t.startDate
        ? []
        : [{ id: t.id, source: "emission", date: t.startDate, km: t.odometerKm, label: t.provider, createdAt: t.createdAt }],
    ),
  ];
  return points.sort(byTime);
}

/** The newest value: the one on the latest date (the highest km if there are several that day). */
export function latestPoint(points: readonly OdometerPoint[]): OdometerPoint | undefined {
  return [...points].sort(byTime).at(-1);
}

export type FitResult = { ok: true } | { ok: false; error: string };

const km = (n: number) => `${n.toLocaleString("en-LK")} km`;

/**
 * Does a new or edited value fit the history? An odometer only goes up, so it may not be below
 * anything on or before its date, or above anything after it. `points` must NOT include the one
 * being edited.
 */
export function checkFits(points: readonly OdometerPoint[], candidate: { date: string; km: number }): FitResult {
  const before = points.filter((p) => p.date <= candidate.date);
  const after = points.filter((p) => p.date > candidate.date);
  const highestBefore = before.reduce<OdometerPoint | undefined>((m, p) => (!m || p.km > m.km ? p : m), undefined);
  const lowestAfter = after.reduce<OdometerPoint | undefined>((m, p) => (!m || p.km < m.km ? p : m), undefined);

  if (highestBefore && candidate.km < highestBefore.km) {
    return { ok: false, error: `${km(candidate.km)} is lower than the earlier value of ${km(highestBefore.km)} on ${highestBefore.date}. An odometer only goes up: check the number or the date.` };
  }
  if (lowestAfter && candidate.km > lowestAfter.km) {
    return { ok: false, error: `${km(candidate.km)} is higher than the later value of ${km(lowestAfter.km)} on ${lowestAfter.date}. Check the number or the date.` };
  }
  return { ok: true };
}

export type PointWithDistance = OdometerPoint & {
  /** km since the previous point, or null for the first. */
  sinceKm: number | null;
  /** Days since the previous point, or null for the first. */
  sinceDays: number | null;
};

/** The history with the distance and time since the previous point, oldest first. */
export function withDistances(points: readonly OdometerPoint[]): PointWithDistance[] {
  const sorted = [...points].sort(byTime);
  return sorted.map((p, i) => {
    const prev = sorted[i - 1];
    return { ...p, sinceKm: prev ? p.km - prev.km : null, sinceDays: prev ? daysBetween(prev.date, p.date) : null };
  });
}

/**
 * The points that don't fit (issue #181): an odometer only goes up, so the trustworthy history is the
 * longest run of points whose km never falls as the dates go on. A point is flagged unless it is in
 * every such run: one wrong value (a typo, a misread certificate) is flagged on its own, and when two
 * values contradict each other and nothing says which is wrong, both are. Certificates and services
 * are saved even when they don't fit; the flag shows it, and the flagged points are left out of the
 * latest value, the distances and the check for a new typed reading until they are corrected.
 * Returns the flagged points' `source:id` keys.
 */
export function unfitKeys(points: readonly OdometerPoint[]): Set<string> {
  const sorted = [...points].sort(byTime);
  const n = sorted.length;
  const up = (a: OdometerPoint, b: OdometerPoint) => a.date < b.date ? a.km <= b.km : a.date === b.date;
  // ending[i]: the longest fitting run ending at i; starting[i]: the longest starting at i.
  const ending = new Array<number>(n).fill(1);
  const starting = new Array<number>(n).fill(1);
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) if (up(sorted[j], sorted[i])) ending[i] = Math.max(ending[i], ending[j] + 1);
  for (let i = n - 1; i >= 0; i--) for (let j = i + 1; j < n; j++) if (up(sorted[i], sorted[j])) starting[i] = Math.max(starting[i], starting[j] + 1);
  const longest = Math.max(0, ...ending);
  // A point is in some longest run when the two lengths meet; it is in every one when no other such
  // point can take its place in the run (the same position).
  const onARun = sorted.map((_, i) => ending[i] + starting[i] - 1 === longest);
  const atPosition = new Map<number, number>();
  sorted.forEach((_, i) => {
    if (onARun[i]) atPosition.set(ending[i], (atPosition.get(ending[i]) ?? 0) + 1);
  });
  const flagged = new Set<string>();
  sorted.forEach((p, i) => {
    if (!onARun[i] || (atPosition.get(ending[i]) ?? 0) > 1) flagged.add(pointKey(p));
  });
  return flagged;
}

/** A point's key: ids are unique per table, so the source goes with them. */
export function pointKey(p: Pick<OdometerPoint, "source" | "id">): string {
  return `${p.source}:${p.id}`;
}
