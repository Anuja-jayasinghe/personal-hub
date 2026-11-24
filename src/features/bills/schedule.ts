/**
 * Schedule maths for bills and subscriptions (Phase 3). Pure: no database, no clock. Dates are
 * "YYYY-MM-DD" calendar days. A monthly item remembers the day of the month it is really due (its
 * "anchor day"), so a bill due on the 31st goes Jan 31, Feb 28, Mar 31 and does not drift to the 28th.
 */

import { dayMonth } from "@/lib/dates";

export const FREQUENCIES =["weekly", "monthly", "quarterly", "yearly", "one_off"] as const;
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

type ScheduledItem = { kind: "bill" | "subscription"; frequency: Frequency; autopay: boolean; anchorDay: number | null };

/**
 * The bill date of the bill that is due by `payBy` (owner, 2026-11-24). A "bill-day item" is a monthly
 * bill that is not on autopay: its provider processes each bill on the bill day (the anchor day) and it
 * can only be paid after that day. Its stored due date is the **pay-by date**, the next bill day after the
 * bill being paid (S.5, C110), so the bill it settles was processed one month earlier: with bill day the
 * 6th, a stored 6 Dec settles "the 6 Nov bill" and 6 Jan is the pay-by date of "the 6 Dec bill". Null for
 * every other item (subscriptions, autopay, weekly, quarterly, yearly, one-off): their date is only the
 * date to pay by, and the screens keep saying so.
 */
export function billDateOf(item: ScheduledItem, payBy: string): string | null {
  if (item.kind !== "bill" || item.frequency !== "monthly" || item.autopay) return null;
  return addMonthsKeepingDay(payBy, -1, item.anchorDay ?? anchorDayOf(payBy));
}

/**
 * The first day the bill due by `due` can be paid: the day after its bill date, since the provider
 * processes it on the bill day (the bill of 6 Dec is payable from the 7th). Null means payable at any
 * time: every item that is not a bill-day item (see `billDateOf`).
 */
export function payableFrom(item: ScheduledItem, due: string): string | null {
  const billDate = billDateOf(item, due);
  return billDate === null ? null : addDaysTo(billDate, 1);
}

/**
 * Why an item cannot be paid today, or null when it can. A bill-day item whose bill is not processed
 * yet cannot ("The 6 Dec bill is processed on 6 Dec and can be paid from 7 Dec."); everything else can
 * always be paid. Mark paid checks this inside its transaction.
 */
export function payRefusal(item: ScheduledItem & { nextDueDate: string | null }, today: string): string | null {
  if (item.nextDueDate === null) return null;
  const from = payableFrom(item, item.nextDueDate);
  if (from === null || from <= today) return null;
  const billDay = dayMonth(billDateOf(item, item.nextDueDate)!);
  return `The ${billDay} bill is processed on ${billDay} and can be paid from ${dayMonth(from)}.`;
}

/**
 * The words for a bill-day item's bill, in bill dates (owner, 2026-11-24). `payBy` is the stored due
 * date; `today` decides whether the bill can be paid yet. Null for every other item, which keeps the
 * old "due date" wording.
 */
export type BillDayWording =
  | { payable: false; nextBill: string; payableFrom: string }
  | { payable: true; billOf: string; payBy: string };

export function billDayWording(item: ScheduledItem, payBy: string, today: string): BillDayWording | null {
  const billDate = billDateOf(item, payBy);
  if (billDate === null) return null;
  const from = addDaysTo(billDate, 1);
  return from > today
    ? { payable: false, nextBill: dayMonth(billDate), payableFrom: dayMonth(from) }
    : { payable: true, billOf: dayMonth(billDate), payBy: dayMonth(payBy) };
}

/** Meta line of a due entry in a list: "6 Nov bill · pay by 6 Dec". */
export const billDayMeta = (billDate: string, payBy: string): string => `${dayMonth(billDate)} bill · pay by ${dayMonth(payBy)}`;

/** Help text under Mark paid; `formatLong` writes a date for the old wording (e.g. "6 Dec 2026"). */
export function markPaidHelp(item: ScheduledItem & { nextDueDate: string }, formatLong: (ymd: string) => string): string {
  const billDate = billDateOf(item, item.nextDueDate);
  if (billDate !== null) return `Records a payment for the ${dayMonth(billDate)} bill and moves on to the ${dayMonth(item.nextDueDate)} bill.`;
  return `Records a payment for the ${formatLong(item.nextDueDate)} due date${item.frequency === "one_off" ? " and marks this item done." : " and moves the next due date forward."}`;
}

/** What a recorded payment settled: "the 6 Nov bill" for a bill-day item, else "the 6 Dec 2026 due date". */
export function paymentFor(item: ScheduledItem, dueDate: string, formatLong: (ymd: string) => string): string {
  const billDate = billDateOf(item, dueDate);
  return billDate !== null ? `the ${dayMonth(billDate)} bill` : `the ${formatLong(dueDate)} due date`;
}

/** A due entry's title with its bill date, for the calendar list: "SLT Fibre · 6 Nov bill". */
export const titleWithBill = (title: string, billDate: string | null | undefined): string => (billDate ? `${title} · ${dayMonth(billDate)} bill` : title);

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
