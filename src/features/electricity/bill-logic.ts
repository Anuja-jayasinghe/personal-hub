import { daysBetween } from "@/lib/dates";
import { fromCents, toCents } from "@/lib/decimal";

/** Rules for electricity bills. Pure (no database, no clock), so they can be tested. */

export type BillStatus =
  | { state: "paid"; paidDate: string }
  | { state: "overdue"; days: number }
  | { state: "due"; days: number }
  | { state: "no-due-date" };

/**
 * Where a bill stands as of `today`: paid (any paid date), otherwise overdue (past its due date),
 * due (days left, 0 = today), or "no-due-date". `days` is days overdue or days remaining.
 */
export function billStatus(bill: { dueDate: string | null; paidDate: string | null }, today: string): BillStatus {
  if (bill.paidDate) return { state: "paid", paidDate: bill.paidDate };
  if (!bill.dueDate) return { state: "no-due-date" };
  const left = daysBetween(today, bill.dueDate);
  return left < 0 ? { state: "overdue", days: -left } : { state: "due", days: left };
}

/** Units the bill shows by default: current minus previous reading, as a decimal string, or null if it would be negative (e.g. a replaced meter). */
export function defaultUnits(previous: string, current: string): string | null {
  const diff = toCents(current) - toCents(previous);
  return diff < 0 ? null : fromCents(diff);
}
