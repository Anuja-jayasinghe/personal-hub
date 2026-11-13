import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { describeDays } from "@/features/reminders/engine";
import { daysUntil, type Occurrence } from "@/features/bills/upcoming";
import { formatDate, formatMoney } from "@/lib/format";

const SHOWN = 10;

function UpcomingRow({ o, today }: { o: Occurrence; today: string }) {
  const d = daysUntil(today, o);
  return (
    <li className="px-3 py-2">
      <div className="flex items-baseline justify-between gap-3">
        <Link href={o.href} className="min-w-0 truncate font-medium underline-offset-2 hover:underline">
          {o.title}
        </Link>
        <span className={`shrink-0 text-sm ${o.overdue ? "font-medium text-status-overdue" : d <= 7 ? "text-status-soon" : "text-muted-foreground"}`}>{describeDays(d)}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{o.kind === "electricity" ? "Electricity" : o.kind === "subscription" ? "Subscription" : "Bill"}</Badge>
        {o.autopay ? <Badge variant="secondary">Autopay</Badge> : null}
        <span>{formatDate(o.date)}</span>
        {o.amount !== null ? <span>· {formatMoney(o.amount / 100)}</span> : null}
      </div>
    </li>
  );
}

/** What is overdue and what is due in the next few weeks, soonest first. */
export function UpcomingList({ occurrences, today, days }: { occurrences: Occurrence[]; today: string; days: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-4" aria-hidden /> Upcoming
        </CardTitle>
        <CardDescription>Overdue items and everything due in the next {days} days. Unpaid electricity bills are shown here too; they are managed on the Electricity page.</CardDescription>
      </CardHeader>
      <CardContent>
        {occurrences.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing due in the next {days} days.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <ul className="flex flex-col divide-y rounded-lg border">
              {occurrences.slice(0, SHOWN).map((o) => (
                <UpcomingRow key={o.key} o={o} today={today} />
              ))}
            </ul>
            {occurrences.length > SHOWN ? (
              <details className="rounded-lg border">
                <summary className="cursor-pointer px-3 py-1.5 text-sm text-muted-foreground">Show {occurrences.length - SHOWN} more</summary>
                <ul className="flex flex-col divide-y border-t">
                  {occurrences.slice(SHOWN).map((o) => (
                    <UpcomingRow key={o.key} o={o} today={today} />
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
