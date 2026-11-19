import { electricityBillHref, meterBillLabel } from "@/features/electricity/links";
import { toCents } from "@/lib/decimal";
import type { Occurrence } from "./upcoming";

/**
 * Unpaid electricity bills as entries for the Bills page's due list (Phase 3.5; C106: they are now
 * handled on the Bills page itself, so each entry links to the bill's row there). Labelled by account
 * number when there is one (S.5). Not part of the monthly commitments (the amount varies). Pure.
 */
export type UnpaidElectricityBill = {
  id: string;
  meterName: string;
  /** Shown instead of the name when set, to match the paper bill (S.5). */
  accountNumber?: string | null;
  /** "YYYY-MM-DD" */
  dueDate: string | null;
  /** LKR as a decimal string, or null. */
  amount: string | null;
};

export function electricityOccurrences(bills: readonly UnpaidElectricityBill[], today: string): Occurrence[] {
  return bills.flatMap((b): Occurrence[] =>
    b.dueDate
      ? [
          {
            key: `electricity-bill:${b.id}`,
            date: b.dueDate,
            title: `Electricity · ${meterBillLabel({ name: b.meterName, accountNumber: b.accountNumber ?? null })}`,
            kind: "electricity",
            amount: b.amount === null ? null : toCents(b.amount),
            autopay: false,
            overdue: b.dueDate < today,
            itemId: null,
            href: electricityBillHref(b.id),
          },
        ]
      : [],
  );
}
