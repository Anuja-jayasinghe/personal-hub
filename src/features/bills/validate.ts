import { isValidDate } from "@/lib/dates";
import { isFrequency, type Frequency } from "./schedule";

/** Validation for bills and subscriptions. Pure (plain strings in, plain values out), so it is testable. */

const clean = (v: string | undefined) => (v ?? "").trim().replace(/\s+/g, " ");

export type BillItemFields = {
  kind: "bill" | "subscription";
  name: string;
  frequency: Frequency;
  nextDueDate: string;
  amount: string | null;
  autopay: boolean;
  paymentMethod: string | null;
  notes: string | null;
};
export type BillItemResult = { ok: true; value: BillItemFields } | { ok: false; error: string };

/** 13 to 19 digits, with or without spaces or dashes between them: what a card number looks like. */
const CARD_NUMBER_RE = /\d(?:[ -]?\d){12,18}/;

/** True when text looks like a payment card number. Such a value is refused, never stored. */
export function looksLikeCardNumber(text: string): boolean {
  return CARD_NUMBER_RE.test(text);
}

export function parseBillItem(raw: Record<string, string | undefined>): BillItemResult {
  const kind = (raw.kind ?? "bill").trim();
  if (kind !== "bill" && kind !== "subscription") return { ok: false, error: "Type must be a bill or a subscription." };

  const name = clean(raw.name);
  if (!name) return { ok: false, error: "Name is required." };
  if (name.length > 80) return { ok: false, error: "Name must be at most 80 characters." };

  const frequency = (raw.frequency ?? "").trim();
  if (!isFrequency(frequency)) return { ok: false, error: "Pick how often it is paid." };

  const nextDueDate = (raw.nextDueDate ?? "").trim();
  if (!nextDueDate) return { ok: false, error: "Next due date is required." };
  if (!isValidDate(nextDueDate)) return { ok: false, error: "Next due date must be a valid date." };

  const amountRaw = (raw.amount ?? "").replace(/,/g, "").trim();
  let amount: string | null = null;
  if (amountRaw) {
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(amountRaw)) return { ok: false, error: "Amount must be a number like 1500 or 1500.50." };
    amount = amountRaw;
  }

  const paymentMethod = clean(raw.paymentMethod);
  if (paymentMethod.length > 60) return { ok: false, error: "Payment method must be at most 60 characters." };
  if (looksLikeCardNumber(paymentMethod)) {
    return { ok: false, error: "That looks like a card number. Card numbers are never stored: write a label such as \"Visa, Sampath\" instead." };
  }

  const notes = (raw.notes ?? "").trim();
  if (notes.length > 500) return { ok: false, error: "Notes must be at most 500 characters." };
  if (looksLikeCardNumber(notes)) {
    return { ok: false, error: "The notes look like they contain a card number. Card numbers are never stored: remove it." };
  }

  return {
    ok: true,
    value: {
      kind,
      name,
      frequency,
      nextDueDate,
      amount,
      autopay: raw.autopay === "on",
      paymentMethod: paymentMethod || null,
      notes: notes || null,
    },
  };
}
