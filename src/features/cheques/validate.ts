import { CHEQUE_STATUSES, type ChequeStatus } from "@/db/schema/cheques";
import { looksLikeCardNumber } from "@/features/bills/validate";
import { addDays, isValidDate } from "@/lib/dates";
import { toCents } from "@/lib/decimal";

/**
 * Validation for received cheques (issue #178, C158). Pure: plain strings in, plain values out. The
 * messages never repeat what was typed (a name, an amount, a cheque number), so an error can be shown or
 * logged without leaking it.
 */

const clean = (v: string | undefined) => (v ?? "").trim().replace(/\s+/g, " ");

export type ChequeFields = {
  fromParty: string;
  amount: string;
  bank: string | null;
  chequeNumber: string | null;
  chequeDate: string;
  note: string | null;
};
export type ChequeResult = { ok: true; value: ChequeFields } | { ok: false; error: string };

/** How far from today a cheque date may be (a typo such as 2062 is caught); an unchanged date is never re-checked. */
export const DATE_DAYS_BACK = 365;
export const DATE_DAYS_AHEAD = 730;

/**
 * `today` bounds the cheque date. `keepDate` is the date already stored when editing, so a cheque that is
 * long past can still have its note fixed without the date being questioned again.
 */
export function parseCheque(raw: Record<string, string | undefined>, today: string, keepDate?: string): ChequeResult {
  const fromParty = clean(raw.fromParty);
  if (!fromParty) return { ok: false, error: "Who gave you the cheque is required." };
  if (fromParty.length > 80) return { ok: false, error: "Who gave you the cheque must be at most 80 characters." };

  const amountRaw = (raw.amount ?? "").replace(/,/g, "").trim();
  if (!amountRaw) return { ok: false, error: "The amount is required." };
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(amountRaw)) return { ok: false, error: "The amount must be a number like 25000 or 25000.50." };
  if (toCents(amountRaw) <= 0) return { ok: false, error: "The amount must be more than zero." };

  const bank = clean(raw.bank);
  if (bank.length > 60) return { ok: false, error: "The bank must be at most 60 characters." };

  const chequeNumber = clean(raw.chequeNumber);
  if (chequeNumber.length > 20) return { ok: false, error: "The cheque number must be at most 20 characters." };
  if (chequeNumber && !/^[A-Za-z0-9][A-Za-z0-9 -]*$/.test(chequeNumber)) return { ok: false, error: "The cheque number can only have letters, digits, spaces and dashes." };
  if (chequeNumber && looksLikeCardNumber(chequeNumber)) return { ok: false, error: "That looks like a card number. Card numbers are never stored." };

  const chequeDate = (raw.chequeDate ?? "").trim();
  if (!chequeDate) return { ok: false, error: "The cheque date is required." };
  if (!isValidDate(chequeDate)) return { ok: false, error: "The cheque date must be a valid date." };
  if (chequeDate !== keepDate && isValidDate(today)) {
    if (chequeDate < addDays(today, -DATE_DAYS_BACK)) return { ok: false, error: "That cheque date is more than a year ago. Check the year." };
    if (chequeDate > addDays(today, DATE_DAYS_AHEAD)) return { ok: false, error: "That cheque date is more than two years away. Check the year." };
  }

  const note = (raw.note ?? "").trim();
  if (note.length > 300) return { ok: false, error: "The note must be at most 300 characters." };
  if (looksLikeCardNumber(note)) return { ok: false, error: "The note looks like it contains a card number. Card numbers are never stored: remove it." };

  return { ok: true, value: { fromParty, amount: amountRaw, bank: bank || null, chequeNumber: chequeNumber || null, chequeDate, note: note || null } };
}

export type StatusChange = { status: ChequeStatus; depositedOn: string | null };
export type StatusResult = { ok: true; value: StatusChange } | { ok: false; error: string };

/**
 * A status change from the form: the new status and, for "deposited", the day it was deposited (today when
 * left empty; it may not be in the future). Any other status carries no date here: moving on from deposited
 * keeps the stored one, and going back to waiting forgets it (`depositedOnAfter`).
 */
export function parseStatusChange(raw: Record<string, string | undefined>, today: string): StatusResult {
  const status = (raw.status ?? "").trim();
  if (!(CHEQUE_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "That status is not valid." };
  if (status !== "deposited") return { ok: true, value: { status: status as ChequeStatus, depositedOn: null } };
  const day = (raw.depositedOn ?? "").trim() || today;
  if (!isValidDate(day)) return { ok: false, error: "The deposit date must be a valid date." };
  if (day > today) return { ok: false, error: "The deposit date cannot be in the future." };
  return { ok: true, value: { status: "deposited", depositedOn: day } };
}

/** The deposit date a cheque keeps after moving to `to`: the new one when deposited, none when back to waiting, otherwise what it had. */
export function depositedOnAfter(to: ChequeStatus, change: StatusChange, current: string | null): string | null {
  if (to === "deposited") return change.depositedOn;
  if (to === "waiting") return null;
  return current;
}
