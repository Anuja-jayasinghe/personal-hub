/**
 * Schedule maths for bills and subscriptions (Phase 3). Pure: no database, no clock. Dates are
 * "YYYY-MM-DD" calendar days. A monthly item remembers the day of the month it is really due (its
 * "anchor day"), so a bill due on the 31st goes Jan 31, Feb 28, Mar 31 and does not drift to the 28th.
 */

export const FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly", "one_off"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: "Every week",
  monthly: "Every month",
  quarterly: "Every 3 months",
  yearly: "Every year",
  one_off: "One-off",
};

export function isFrequency(value: string): value is Frequency {
  return (FREQUENCIES as readonly string[]).includes(value);
}

const MONTHS_PER_STEP: Record<Exclude<Frequency, "weekly" | "one_off">, number> = { monthly: 1, quarterly: 3, yearly: 12 };

function parts(ymd: string): { y: number; m: number; d: number } {
  return { y: Number(ymd.slice(0, 4)), m: Number(ymd.slice(5, 7)), d: Number(ymd.slice(8, 10)) };
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** Days in a month (month 1 to 12), leap years included. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The day of the month of a date: what a monthly item should keep coming back to. */
export function anchorDayOf(ymd: string): number {
  return parts(ymd).d;
}

/** `ymd` moved by whole months, landing on `anchorDay` or on the last day of a shorter month. */
export function addMonthsKeepingDay(ymd: string, months: number, anchorDay: number): string {
  const { y, m } = parts(ymd);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${pad(year, 4)}-${pad(month)}-${pad(Math.min(anchorDay, daysInMonth(year, month)))}`;
}

/**
 * The first date after `today` that falls on `billDay` (or on the last day of a shorter month): when a
 * monthly bill that arrives on that day must be paid by, since it is paid before the next one arrives
 * (S.5, owner's item 31). On 19 Nov a bill that arrives on the 5th is due by 5 Dec; one that arrives on
 * the 25th by 25 Nov.
 */
export function nextBillDayAfter(today: string, billDay: number): string {
  const thisMonth = addMonthsKeepingDay(today, 0, billDay);
  return thisMonth > today ? thisMonth : addMonthsKeepingDay(today, 1, billDay);
}

function addDaysTo(ymd: string, days: number): string {
  const { y, m, d } = parts(ymd);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * The first day a due date can be paid (owner, 2026-11-24). A monthly bill that is not on autopay is
 * processed by its provider on the bill day, so the bill due by `due` (the next bill day, S.5) does not
 * exist, and is not shown or reminded, until the bill day before it has passed: SLT's bill of the 6th
 * of December is only payable from the 7th. Null means payable at any time: subscriptions, items on
 * autopay and every other frequency (their date is the date to pay by, shown ahead as before).
 */
export function payableFrom(
  item: { kind: "bill" | "subscription"; frequency: Frequency; autopay: boolean; anchorDay: number | null },
  due: string,
): string | null {
  if (item.kind !== "bill" || item.frequency !== "monthly" || item.autopay) return null;
  const arrived = addMonthsKeepingDay(due, -1, item.anchorDay ?? anchorDayOf(due));
  return addDaysTo(arrived, 1);
}

/**
 * The due date after `due`, or null for a one-off item (it is finished once paid).
 * `anchorDay` defaults to the day of `due`.
 */
export function nextDueAfter(frequency: Frequency, due: string, anchorDay: number = anchorDayOf(due)): string | null {
  if (frequency === "one_off") return null;
  if (frequency === "weekly") return addDaysTo(due, 7);
  return addMonthsKeepingDay(due, MONTHS_PER_STEP[frequency], anchorDay);
}

/**
 * The first due date on or after `today` for an item that pays itself (autopay, DECISIONS C58):
 * past dates are assumed to have been paid by the bank, so the schedule is rolled forward until it
 * reaches today or later. Null when there is nothing left (a one-off whose date has passed, or an
 * item with no due date). A date that is not in the past is returned as it is.
 */
export function rollForward(
  item: { frequency: Frequency; nextDueDate: string | null; anchorDay: number | null },
  today: string,
): string | null {
  let due = item.nextDueDate;
  for (let i = 0; due !== null && due < today; i++) {
    if (i > 10_000) return null; // safety net: a corrupt date can never loop for ever
    due = nextDueAfter(item.frequency, due, item.anchorDay ?? undefined);
  }
  return due;
}
