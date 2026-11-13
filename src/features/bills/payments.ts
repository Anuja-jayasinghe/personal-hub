import { nextDueAfter, type Frequency } from "./schedule";

/**
 * Rules for recording and undoing payments (Phase 3.2). Pure: no database, no clock.
 * A payment settles the item's current due date and moves it forward by the frequency; a one-off
 * item is finished once paid (no next due date).
 */

export type PayableItem = { frequency: Frequency; nextDueDate: string | null; anchorDay: number | null };

export type PayResult =
  | { ok: true; settles: string; nextDueDate: string | null }
  | { ok: false; error: string };

/** What paying an item settles, and its due date afterwards. */
export function applyPayment(item: PayableItem): PayResult {
  if (item.nextDueDate === null) return { ok: false, error: "This item is already done: there is nothing left to pay." };
  return {
    ok: true,
    settles: item.nextDueDate,
    nextDueDate: nextDueAfter(item.frequency, item.nextDueDate, item.anchorDay ?? undefined),
  };
}

type Recorded = { id: string; paidDate: string; createdAt: Date };

/** Newest first: by paid date, then by the order recorded. */
export function sortPayments<T extends Recorded>(payments: readonly T[]): T[] {
  return [...payments].sort((a, b) => b.paidDate.localeCompare(a.paidDate) || b.createdAt.getTime() - a.createdAt.getTime());
}

/** The payment recorded most recently (the one an undo applies to). */
export function lastRecorded<T extends Recorded>(payments: readonly T[]): T | undefined {
  return [...payments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

/**
 * Deleting a payment puts the item back to due on the date it settled, but only when it is the
 * most recently recorded payment and the item has not been moved to an earlier date by hand since.
 * Returns that date, or null to leave the schedule alone.
 */
export function dueAfterUndo(
  payments: readonly Recorded[],
  deletedId: string,
  settled: string,
  currentDue: string | null,
): string | null {
  if (lastRecorded(payments)?.id !== deletedId) return null;
  if (currentDue !== null && currentDue <= settled) return null;
  return settled;
}
