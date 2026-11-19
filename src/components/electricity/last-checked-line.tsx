import { checkedText, isOverdue, type LastChecked } from "@/features/electricity/last-checked";

/** "Checked 3 days ago" in the mono label style; amber once a check is overdue (2b.4). */
export function LastCheckedLine({ check }: { check: LastChecked }) {
  const overdue = isOverdue(check);
  return (
    <span className={`flex items-center gap-1.5 font-mono text-[11px] tracking-wide tabular-nums ${overdue ? "font-medium text-status-soon" : "text-label"}`}>
      {overdue ? <span aria-hidden className="size-1.5 rounded-full bg-status-soon-mark" /> : null}
      {checkedText(check)}
      {overdue ? <span className="sr-only"> (a check is due)</span> : null}
    </span>
  );
}
