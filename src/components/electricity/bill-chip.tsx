import type { BillStatus } from "@/features/electricity/bill-logic";

const base = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium";

/** One short chip for a bill's state: Paid, Unpaid (with the due date), or Overdue, in the state colours (C92). */
export function BillChip({ status }: { status: BillStatus }) {
  if (status.state === "paid") {
    return (
      <span className={`${base} bg-status-ok-soft text-status-ok`}>
        <span aria-hidden className="size-1.5 rounded-full bg-status-ok" />
        Paid
      </span>
    );
  }
  if (status.state === "overdue") {
    return (
      <span className={`${base} bg-status-overdue-soft text-status-overdue`}>
        <span aria-hidden className="size-1.5 rounded-full bg-status-overdue" />
        Overdue {status.days} day{status.days === 1 ? "" : "s"}
      </span>
    );
  }
  const text = status.state === "due" ? (status.days === 0 ? "Unpaid, due today" : `Unpaid, due in ${status.days} day${status.days === 1 ? "" : "s"}`) : "Unpaid";
  return (
    <span className={`${base} bg-status-soon-soft text-status-soon`}>
      <span aria-hidden className="size-1.5 rounded-full bg-status-soon-mark" />
      {text}
    </span>
  );
}
