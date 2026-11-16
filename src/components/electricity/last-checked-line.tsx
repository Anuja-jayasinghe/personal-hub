import { Clock } from "lucide-react";
import { checkedText, isOverdue, type LastChecked } from "@/features/electricity/last-checked";

/** "Checked 3 days ago" with a small clock; amber and bold once a check is overdue (2b.4). */
export function LastCheckedLine({ check }: { check: LastChecked }) {
  const overdue = isOverdue(check);
  return (
    <span className={`flex items-center gap-1.5 text-sm tabular-nums ${overdue ? "font-medium text-amber-800 dark:text-amber-200" : "text-muted-foreground"}`}>
      <Clock className="size-4" aria-hidden />
      {checkedText(check)}
      {overdue ? <span className="sr-only"> (a check is due)</span> : null}
    </span>
  );
}
