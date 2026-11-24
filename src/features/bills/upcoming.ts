import { addDays, daysBetween } from "@/lib/dates";
import { toCents } from "@/lib/decimal";
import { nextDueAfter, payableFrom, rollForward, type Frequency } from "./schedule";

/**
 * What is coming up, the calendar grid and the monthly commitments (Phase 3.4). Pure: no database,
 * no clock. Amounts are whole hundredths of a rupee (LKR, C21) so sums are exact.
 */

export type BillLike = {
  id: string;
  name: string;
  kind: "bill" | "subscription";
  frequency: Frequency;
  nextDueDate: string | null;
  anchorDay: number | null;
  /** The usual amount in hundredths, or null. */
  amount: number | null;
  autopay: boolean;
};

/** A stored bill item as the pure functions here want it (amount in hundredths). */
export function toBillLike(row: {
  id: string;
  name: string;
  kind: "bill" | "subscription";
  frequency: Frequency;
  nextDueDate: string | null;
  anchorDay: number | null;
  amount: string | null;
  autopay: boolean;
}): BillLike {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    frequency: row.frequency,
    nextDueDate: row.nextDueDate,
    anchorDay: row.anchorDay,
    amount: row.amount === null ? null : toCents(row.amount),
    autopay: row.autopay,
  };
}

/** One date something is due. Electricity bills (3.5) come in as `kind: "electricity"`. */
export type Occurrence = {
  /** Unique, e.g. "bill-item:<id>:2026-12-01". */
  key: string;
  date: string;
  title: string;
  kind: "bill" | "subscription" | "electricity";
  amount: number | null;
  autopay: boolean;
  /** True for a not-yet-paid date already in the past. */
  overdue: boolean;
  /** The bill item it belongs to, or null (electricity bills live on their own page). */
  itemId: string | null;
  href: string;
};

/**
 * The dates an item falls due up to and including `to`, starting from now.
 * - An item that pays itself (autopay) starts at its next charge on or after `today`.
 * - Any other item starts at its stored due date; if that is in the past it counts once as
 *   overdue (like in Reminders), and later dates that are also already past are not repeated.
 * - A monthly bill is not shown ahead of time: a date appears only once it can be paid (`payableFrom`),
 *   so the bill of the 6th of next month is not listed on the 24th of this one (owner, 2026-11-24).
 * Finished one-off items have no dates.
 */
export function occurrencesOf(item: BillLike, today: string, to: string): Occurrence[] {
  if (item.nextDueDate === null) return [];
  const out: Occurrence[] = [];
  const make = (date: string, overdue: boolean): Occurrence => ({
    key: `bill-item:${item.id}:${date}`,
    date,
    title: item.name,
    kind: item.kind,
    amount: item.amount,
    autopay: item.autopay,
    overdue,
    itemId: item.id,
    href: `/bills#item-${item.id}`,
  });
  const step = (date: string) => nextDueAfter(item.frequency, date, item.anchorDay ?? undefined);

  let date: string | null;
  if (item.autopay) {
    date = rollForward(item, today);
  } else {
    date = item.nextDueDate;
    if (date < today) {
      out.push(make(date, true));
      date = step(date);
      while (date !== null && date < today) date = step(date);
    }
  }
  for (let i = 0; date !== null && date <= to && i < 1000; i++) {
    const from = payableFrom(item, date);
    if (from !== null && from > today) break; // later dates are even further from payable
    out.push(make(date, false));
    date = step(date);
  }
  return out;
}

/** The Upcoming list: every item's dates from overdue through `days` ahead, soonest first. */
export function upcoming(items: readonly BillLike[], extra: readonly Occurrence[], today: string, days: number): Occurrence[] {
  const to = addDays(today, days);
  const all = [...items.flatMap((i) => occurrencesOf(i, today, to)), ...extra.filter((o) => o.date <= to)];
  return all.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

/** Days from `today` to an occurrence; negative when overdue. */
export const daysUntil = (today: string, o: Occurrence): number => daysBetween(today, o.date);

// ---- Monthly commitments -----------------------------------------------------------------------

/** What an amount costs per month for a recurring item; null for a one-off item (not recurring). */
export function monthlyEquivalent(frequency: Frequency, amount: number): number | null {
  switch (frequency) {
    case "weekly":
      return Math.round((amount * 52) / 12);
    case "monthly":
      return amount;
    case "quarterly":
      return Math.round(amount / 3);
    case "yearly":
      return Math.round(amount / 12);
    case "one_off":
      return null;
  }
}

/** What an amount costs per year for a recurring item, exactly. */
function yearlyEquivalent(frequency: Frequency, amount: number): number {
  return amount * { weekly: 52, monthly: 12, quarterly: 4, yearly: 1, one_off: 0 }[frequency];
}

export type CommitmentLine = { id: string; name: string; kind: "bill" | "subscription"; frequency: Frequency; amount: number; monthly: number };

export type Commitments = {
  /** Per month, all recurring items that have a usual amount. */
  total: number;
  bills: number;
  subscriptions: number;
  /** Per year, summed exactly (not 12 x the rounded monthly figure). */
  perYear: number;
  /** Largest first. */
  lines: CommitmentLine[];
  /** Recurring items with no usual amount: listed, not counted. */
  withoutAmount: { id: string; name: string }[];
};

/**
 * The total of your recurring items per month. Pass active (not archived) items. One-off items and
 * finished items are not recurring, so they are left out; items without a usual amount are listed
 * separately. Electricity bills are not part of this (C57: the amount varies).
 */
export function commitments(items: readonly BillLike[]): Commitments {
  const recurring = items.filter((i) => i.frequency !== "one_off" && i.nextDueDate !== null);
  const lines: CommitmentLine[] = [];
  const withoutAmount: { id: string; name: string }[] = [];
  let perYear = 0;
  for (const i of recurring) {
    if (i.amount === null) {
      withoutAmount.push({ id: i.id, name: i.name });
      continue;
    }
    lines.push({ id: i.id, name: i.name, kind: i.kind, frequency: i.frequency, amount: i.amount, monthly: monthlyEquivalent(i.frequency, i.amount) ?? 0 });
    perYear += yearlyEquivalent(i.frequency, i.amount);
  }
  lines.sort((a, b) => b.monthly - a.monthly || a.name.localeCompare(b.name));
  const sum = (kind: "bill" | "subscription") => lines.filter((l) => l.kind === kind).reduce((s, l) => s + l.monthly, 0);
  return { total: lines.reduce((s, l) => s + l.monthly, 0), bills: sum("bill"), subscriptions: sum("subscription"), perYear, lines, withoutAmount };
}

// ---- Calendar ----------------------------------------------------------------------------------

/** The weeks of a month ("YYYY-MM"), Monday first. Cells outside the month are null. */
export function monthGrid(month: string): (string | null)[][] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0 = Sunday
  const lead = (first + 6) % 7; // blanks before the 1st, Monday first
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: days }, (_, d) => `${month}-${String(d + 1).padStart(2, "0")}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** The last day of a month ("YYYY-MM") as "YYYY-MM-DD". */
export function lastDayOf(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
}

/** Groups occurrences by date, for the calendar cells. */
export function byDate(occurrences: readonly Occurrence[]): Map<string, Occurrence[]> {
  const map = new Map<string, Occurrence[]>();
  for (const o of occurrences) map.set(o.date, [...(map.get(o.date) ?? []), o]);
  return map;
}
