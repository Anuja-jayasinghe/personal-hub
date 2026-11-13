import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { byDate, monthGrid, type Occurrence } from "@/features/bills/upcoming";
import { formatDate, formatMoney } from "@/lib/format";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthTitle = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/**
 * A month grid (plain CSS, no calendar package) of what falls due, with the same entries as a
 * list underneath: the grid is for looking, the list is for reading (and for screen readers).
 */
export function BillsCalendar({
  month,
  today,
  occurrences,
  prevMonth,
  nextMonth,
}: {
  month: string;
  today: string;
  /** Only the entries inside this month. */
  occurrences: Occurrence[];
  /** "YYYY-MM" to link to, or null when that direction is not allowed. */
  prevMonth: string | null;
  nextMonth: string | null;
}) {
  const grouped = byDate(occurrences);
  const weeks = monthGrid(month);
  const dates = [...grouped.keys()].sort();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-4" aria-hidden /> Calendar
        </CardTitle>
        <CardDescription>What falls due each day, from this month onward.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          {prevMonth ? (
            <Link href={`/bills?month=${prevMonth}`} scroll={false} className="inline-flex items-center gap-1 text-sm underline-offset-2 hover:underline" aria-label="Previous month">
              <ChevronLeft className="size-4" aria-hidden /> Previous
            </Link>
          ) : (
            <span />
          )}
          <h3 className="font-medium">{monthTitle.format(new Date(`${month}-01T00:00:00Z`))}</h3>
          {nextMonth ? (
            <Link href={`/bills?month=${nextMonth}`} scroll={false} className="inline-flex items-center gap-1 text-sm underline-offset-2 hover:underline" aria-label="Next month">
              Next <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <span />
          )}
        </div>

        <div aria-hidden className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-xs">
          {WEEKDAYS.map((d) => (
            <div key={d} className="bg-muted px-1 py-1 text-center font-medium text-muted-foreground">
              {d}
            </div>
          ))}
          {weeks.flat().map((date, i) => {
            const entries = date ? (grouped.get(date) ?? []) : [];
            return (
              <div key={date ?? `blank-${i}`} className={`min-h-14 bg-card p-1 sm:min-h-20 ${date === today ? "ring-2 ring-inset ring-primary" : ""}`}>
                {date ? (
                  <>
                    <div className={`text-[11px] ${date === today ? "font-semibold text-primary" : "text-muted-foreground"}`}>{Number(date.slice(8))}</div>
                    {entries.slice(0, 2).map((e) => (
                      <div key={e.key} className={`mt-0.5 truncate rounded px-1 text-[10px] leading-4 ${e.overdue ? "bg-destructive/15 text-status-overdue" : "bg-primary/15"}`}>
                        {e.title}
                      </div>
                    ))}
                    {entries.length > 2 ? <div className="mt-0.5 text-[10px] text-muted-foreground">+{entries.length - 2} more</div> : null}
                  </>
                ) : null}
              </div>
            );
          })}
        </div>

        {dates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing falls due this month.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border text-sm">
            {dates.flatMap((date) =>
              (grouped.get(date) ?? []).map((e) => (
                <li key={e.key} className="flex flex-wrap items-baseline justify-between gap-x-3 px-3 py-1.5">
                  <Link href={e.href} className="font-medium underline-offset-2 hover:underline">
                    {e.title}
                  </Link>
                  <span className="text-muted-foreground">
                    {formatDate(date)}
                    {e.autopay ? " · autopay" : ""}
                    {e.amount !== null ? ` · ${formatMoney(e.amount / 100)}` : ""}
                  </span>
                </li>
              )),
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
