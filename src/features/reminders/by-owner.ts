import type { ReminderResult } from "./engine";

/**
 * How many reminder items each record has, and how many of those are overdue. Pure. Used by the
 * vehicle list to show "2 due" on a card. Items without an owner are ignored.
 */
export function countByOwner(results: readonly ReminderResult[]): Map<string, { total: number; overdue: number }> {
  const counts = new Map<string, { total: number; overdue: number }>();
  for (const r of results) {
    const id = r.item.ownerId;
    if (!id) continue;
    const c = counts.get(id) ?? { total: 0, overdue: 0 };
    c.total += 1;
    if (r.level === "overdue") c.overdue += 1;
    counts.set(id, c);
  }
  return counts;
}
