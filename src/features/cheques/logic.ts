import type { ChequeStatus } from "@/db/schema/cheques";
import { addMonthsToDate, dayMonthIn, daysBetween } from "@/lib/dates";

/**
 * The rules of a received cheque (issue #178, DECISIONS C158). Pure: no database, clock or config; the
 * caller passes `today` ("YYYY-MM-DD", app time zone). Dates are calendar days, never timestamps.
 */

/** A Sri Lankan cheque goes stale this many calendar months after the date written on it. */
export const STALE_AFTER_MONTHS = 6;

/** How many days before it goes stale a waiting cheque is called "going stale". */
export const GOING_STALE_DAYS = 30;

/** The day a cheque goes stale: its date plus six calendar months, keeping the end of the month (31 Aug becomes 28 Feb, or 29 in a leap year). */
export function staleDate(chequeDate: string): string {
  return addMonthsToDate(chequeDate, STALE_AFTER_MONTHS);
}

// ---- Statuses ---------------------------------------------------------------------------------

export const STATUS_LABELS: Record<ChequeStatus, string> = {
  waiting: "Waiting",
  deposited: "Deposited",
  cleared: "Cleared",
  bounced: "Bounced",
  cancelled: "Cancelled",
};

/**
 * Where a cheque may go next. Waiting goes to deposited, or ends as bounced or cancelled; deposited goes to
 * cleared, or ends as bounced or cancelled; and any later state may go back to waiting, which is how a
 * mistake is corrected (the deposit date is then forgotten).
 */
const NEXT: Record<ChequeStatus, readonly ChequeStatus[]> = {
  waiting: ["deposited", "bounced", "cancelled"],
  deposited: ["cleared", "bounced", "cancelled", "waiting"],
  cleared: ["waiting"],
  bounced: ["waiting"],
  cancelled: ["waiting"],
};

export function canMove(from: ChequeStatus, to: ChequeStatus): boolean {
  return NEXT[from].includes(to);
}

/** Done with: nothing more to do about it (these are tucked away on the page). */
export const isFinished = (status: ChequeStatus): boolean => status === "cleared" || status === "bounced" || status === "cancelled";

// ---- How a waiting cheque stands --------------------------------------------------------------

export type ChequeState =
  /** The cheque date is still ahead. */
  | "waiting"
  /** The cheque date is today: it can be deposited now. */
  | "today"
  /** The cheque date has passed and it has not been deposited. */
  | "late"
  /** It goes stale within `GOING_STALE_DAYS` days. */
  | "going-stale"
  /** It went stale: a bank will no longer take it. */
  | "stale"
  | "deposited"
  | "cleared"
  | "bounced"
  | "cancelled";

export type ChequeView = {
  state: ChequeState;
  /** The day it goes stale. */
  staleOn: string;
  /** Days to the cheque date (negative once it has passed) and to the stale date. */
  daysToDate: number;
  daysToStale: number;
  /** The number the ring shows and what it counts out of (see DaysRing): days to deposit, days late, or days to go stale. Null once it is no longer waiting. */
  ring: { days: number; ofDays: number } | null;
  /** The state in a few words, for the chip on the card. */
  chip: string;
  /** The ring and the chip in a sentence, for screen readers. */
  spoken: string;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** How a cheque stands today: the state, the number for its ring, and the words that go with it. */
export function viewOf(cheque: { status: ChequeStatus; chequeDate: string }, today: string): ChequeView {
  const staleOn = staleDate(cheque.chequeDate);
  const daysToDate = daysBetween(today, cheque.chequeDate);
  const daysToStale = daysBetween(today, staleOn);
  const base = { staleOn, daysToDate, daysToStale };

  if (cheque.status !== "waiting") {
    const label = STATUS_LABELS[cheque.status];
    return { ...base, state: cheque.status, ring: null, chip: label, spoken: label };
  }
  if (daysToStale < 0) {
    return {
      ...base,
      state: "stale",
      ring: { days: daysToStale, ofDays: 30 },
      chip: "Went stale",
      spoken: `Went stale ${plural(-daysToStale, "day")} ago`,
    };
  }
  if (daysToStale <= GOING_STALE_DAYS) {
    return {
      ...base,
      state: "going-stale",
      ring: { days: daysToStale, ofDays: GOING_STALE_DAYS },
      chip: daysToStale === 0 ? "Goes stale today" : `Goes stale in ${plural(daysToStale, "day")}`,
      spoken: daysToStale === 0 ? "Goes stale today" : `${plural(daysToStale, "day")} until it goes stale`,
    };
  }
  if (daysToDate < 0) {
    return {
      ...base,
      state: "late",
      ring: { days: daysToDate, ofDays: 30 },
      chip: "Deposit now",
      spoken: `${plural(-daysToDate, "day")} late, deposit it now`,
    };
  }
  if (daysToDate === 0) {
    return { ...base, state: "today", ring: { days: 0, ofDays: 30 }, chip: "Deposit today", spoken: "Can be deposited today" };
  }
  return {
    ...base,
    state: "waiting",
    ring: { days: daysToDate, ofDays: 365 },
    chip: `Can be deposited ${dayMonthIn(cheque.chequeDate, today)}`,
    spoken: `${plural(daysToDate, "day")} until it can be deposited`,
  };
}

/** "Goes stale 10 Dec" / "Went stale 10 Dec" for the small line on a waiting cheque. */
export function staleLine(staleOn: string, today: string): string {
  return `${staleOn < today ? "Went stale" : "Goes stale"} ${dayMonthIn(staleOn, today)}`;
}

// ---- Sorting and totals -----------------------------------------------------------------------

type Row = { status: ChequeStatus; chequeDate: string; depositedOn: string | null };

/** Waiting cheques, the one to deposit first on top. */
export function waitingFirst<T extends Row>(rows: readonly T[]): T[] {
  return rows.filter((r) => r.status === "waiting").sort((a, b) => a.chequeDate.localeCompare(b.chequeDate));
}

/** Deposited cheques that have not cleared yet, the longest-waiting first. */
export function inTheBank<T extends Row>(rows: readonly T[]): T[] {
  return rows.filter((r) => r.status === "deposited").sort((a, b) => (a.depositedOn ?? "").localeCompare(b.depositedOn ?? ""));
}

/** Cleared, bounced and cancelled cheques, the latest first. */
export function finished<T extends Row>(rows: readonly T[]): T[] {
  return rows.filter((r) => isFinished(r.status)).sort((a, b) => b.chequeDate.localeCompare(a.chequeDate));
}
