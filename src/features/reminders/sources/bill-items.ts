import "server-only";
import { listBillItems } from "@/features/bills/queries";
import { rollForward } from "@/features/bills/schedule";
import { formatMoney, todayInAppTz } from "@/lib/format";
import type { ReminderItem, ReminderSource } from "../engine";

/** Autopay heads-up (DECISIONS C58): only the day before and the day itself. */
const AUTOPAY_LEAD_DAYS = [1, 0] as const;

/**
 * Bills and subscriptions (Phase 3.3). Active items remind on their next due date with the
 * app-wide lead times, and stay overdue until you mark them paid. Items on **autopay** only give a
 * heads-up (1 day before and on the day, so the account has the money) and are never overdue:
 * their schedule is rolled forward past dates the bank has already paid. Archived items and a
 * finished one-off send nothing.
 */
export const billItemsSource: ReminderSource = {
  key: "bill-items",
  label: "Bills & subscriptions",
  async load(from) {
    const items = await listBillItems(false, from?.db);
    const today = from?.today ?? todayInAppTz();
    return items.flatMap((item): ReminderItem[] => {
      const dueDate = item.autopay ? rollForward(item, today) : item.nextDueDate;
      if (!dueDate) return [];
      const amount = item.amount !== null ? ` · ${formatMoney(Number(item.amount))}` : "";
      return [
        {
          id: `bill-item:${item.id}`,
          title: `${item.name}${amount}`,
          dueDate,
          href: "/bills",
          kind: item.autopay ? "autopay" : item.kind,
          ownerId: item.id,
          notice: { what: item.name },
          ...(item.autopay ? { leadDays: AUTOPAY_LEAD_DAYS } : {}),
        },
      ];
    });
  },
};
