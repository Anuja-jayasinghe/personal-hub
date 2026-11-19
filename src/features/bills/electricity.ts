import { electricityBillHref } from "@/features/electricity/links";
import { toCents } from "@/lib/decimal";
import type { Occurrence } from "./upcoming";

/**
 * Unpaid electricity bills as entries for the Bills page (Phase 3.5, DECISIONS C57). They are
 * read-only here: they are managed on the Electricity page (mark paid, edit), so each entry links
 * there, and they are not part of the monthly commitments (the amount varies). Pure.
 */
export type UnpaidElectricityBill = {
  id: string;
  meterName: string;
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
            title: `Electricity · ${b.meterName}`,
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
