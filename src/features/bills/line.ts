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

/** How far ahead a recurring item's next date still belongs to "now": one month (S.5). */
export const CURRENT_PERIOD_DAYS = 31;

/**
 * What is to pay now (S.5, owner's item 32): every late date, plus for each item only its next date,
 * and only if that falls within a month. On 19 Nov a monthly bill adds November's bill (due by early
 * December), not December's or January's; last month's is added only while it is unpaid. Electricity
 * bills (no item) count when late or due within the month. Soonest first.
 */
export function toPayNow(occurrences: readonly Occurrence[], today: string): Occurrence[] {
  const seen = new Set<string>();
  const out: Occurrence[] = [];
  for (const o of [...occurrences].sort((a, b) => a.date.localeCompare(b.date))) {
    if (o.overdue) {
      out.push(o);
      continue;
    }
    if (daysBetween(today, o.date) > CURRENT_PERIOD_DAYS) continue;
    const group = o.itemId ?? o.key;
    if (seen.has(group)) continue;
    seen.add(group);
    out.push(o);
  }
  return out;
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
