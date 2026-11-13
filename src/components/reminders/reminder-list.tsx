import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { describeDays, type ReminderLevel, type ReminderResult } from "@/features/reminders/engine";
import { formatDate } from "@/lib/format";

const levelClass: Record<ReminderLevel, string> = {
  overdue: "font-medium text-status-overdue",
  today: "font-medium text-status-soon",
  soon: "text-status-soon",
  upcoming: "text-muted-foreground",
};

/**
 * A list of reminder results. Two lines per item so titles stay readable in narrow cards:
 * title + how soon on the first, kind badge + due date on the second.
 */
export function ReminderList({ results }: { results: readonly ReminderResult[] }) {
  return (
    <ul className="flex flex-col divide-y rounded-lg border bg-card text-card-foreground">
      {results.map(({ item, daysUntil, level }) => (
        <li key={item.id} className="px-4 py-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <Link href={item.href} className="min-w-0 truncate font-medium underline-offset-2 hover:underline">
              {item.title}
            </Link>
            <span className={`shrink-0 text-sm ${levelClass[level]}`}>{describeDays(daysUntil)}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{item.kind}</Badge>
            <span>{formatDate(item.dueDate)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
