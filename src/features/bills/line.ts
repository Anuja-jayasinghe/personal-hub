import type { TimelineDay } from "@/features/home/home";
import { daysBetween } from "@/lib/dates";
import type { Occurrence } from "./upcoming";

/**
 * The Bills page's "To pay" panel (R.5b, board HBills). Pure. Amounts are hundredths of a currency unit.
 */

/** What is still to pay in a list of occurrences, plus how many have no amount (they are not in the total). */
export function toPay(occurrences: readonly Occurrence[]): { cents: number; withoutAmount: number } {
  let cents = 0;
  let withoutAmount = 0;
  for (const o of occurrences) {
    if (o.amount === null) withoutAmount++;
    else cents += o.amount;
  }
  return { cents, withoutAmount };
}

/** Occurrences grouped by day for the 30-day line (the same line as Home): overdue ones at today, in red. */
export function occurrenceDays(occurrences: readonly Occurrence[], today: string, days: number): TimelineDay[] {
  const byDay = new Map<number, TimelineDay>();
  for (const o of occurrences) {
    const until = daysBetween(today, o.date);
    if (until > days) continue;
    const day = Math.max(0, until);
    const entry = byDay.get(day) ?? { day, date: day === 0 ? today : o.date, items: [] };
    entry.items.push({ key: o.key, label: o.title, href: o.href, tone: o.overdue ? "overdue" : "due", daysUntil: until });
    byDay.set(day, entry);
  }
  return [...byDay.values()].sort((a, b) => a.day - b.day);
}
