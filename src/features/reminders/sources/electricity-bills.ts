import "server-only";
import { electricityBillHref, meterBillLabel } from "@/features/electricity/links";
import { listUnpaidBillsWithDueDate } from "@/features/electricity/queries";
import { formatMoney } from "@/lib/format";
import type { ReminderSource } from "../engine";

/**
 * Unpaid electricity bills with a due date (Phase 2.2). A bill stops reminding once it is marked
 * paid. Archiving a meter does not silence its unpaid bills: they are still owed.
 */
export const electricityBillsSource: ReminderSource = {
  key: "electricity-bills",
  label: "Electricity bills",
  async load() {
    const rows = await listUnpaidBillsWithDueDate();
    return rows.flatMap((b) =>
      b.dueDate
        ? [
            {
              id: `electricity-bill:${b.id}`,
              title: `Electricity bill · ${meterBillLabel({ name: b.meterName, accountNumber: b.accountNumber })}${b.amount !== null ? ` · ${formatMoney(Number(b.amount))}` : ""}`,
              dueDate: b.dueDate,
              href: electricityBillHref(b.id),
              kind: "bill",
              ownerId: b.meterId,
            },
          ]
        : [],
    );
  },
};
