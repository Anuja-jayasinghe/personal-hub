import type { BillStatus } from "@/features/electricity/bill-logic";

const base = "inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium";

/** One short chip for a bill's state: Paid, Unpaid (with the due date), or Overdue. */
export function BillChip({ status }: { status: BillStatus }) {
  if (status.state === "paid") {
    return <span className={`${base} bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100`}>Paid</span>;
  }
  if (status.state === "overdue") {
    return (
      <span className={`${base} bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-100`}>
        Overdue {status.days} day{status.days === 1 ? "" : "s"}
      </span>
    );
  }
  const text = status.state === "due" ? (status.days === 0 ? "Unpaid, due today" : `Unpaid, due in ${status.days} day${status.days === 1 ? "" : "s"}`) : "Unpaid";
  return <span className={`${base} bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100`}>{text}</span>;
}

