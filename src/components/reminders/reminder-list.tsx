import Link from "next/link";
import { describeDays, type ReminderLevel, type ReminderResult } from "@/features/reminders/engine";
import { formatDate } from "@/lib/format";

const lamp: Record<ReminderLevel, string> = {
  overdue: "bg-status-overdue",
  today: "bg-status-soon-mark",
  soon: "bg-status-soon-mark",
  upcoming: "bg-label",
};
const when: Record<ReminderLevel, string> = {
  overdue: "text-status-overdue",
  today: "text-status-soon",
  soon: "text-status-soon",
  upcoming: "text-muted-foreground",
};

/**
 * A list of reminder results (restyled in R.5a): a lamp in the state colour, the title with its kind
 * and date under it, and how soon in the mono label style.
 */
export function ReminderList({ results }: { results: readonly ReminderResult[] }) {
  return (
    <ul className="flex flex-col rounded-2xl border bg-card px-4 text-card-foreground">
      {results.map(({ item, daysUntil, level }, i) => (
        <li key={item.id} className={i > 0 ? "border-t border-raised" : ""}>
          <Link href={item.href} className="flex min-h-14 items-center gap-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${lamp[level]}`} />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-[15px] leading-snug font-semibold">{item.title}</span>
              <span className="line-clamp-2 text-xs text-muted-foreground">
                {item.kind} · {formatDate(item.dueDate)}
              </span>
            </span>
            <span className={`shrink-0 font-mono text-[10.5px] uppercase ${when[level]}`}>{describeDays(daysUntil)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
