import Link from "next/link";
import { describeDays } from "@/features/reminders/engine";
import { daysUntil, type Occurrence } from "@/features/bills/upcoming";
import { formatDate, formatMoney } from "@/lib/format";

const SHOWN = 10;

function UpcomingRow({ o, today, first }: { o: Occurrence; today: string; first: boolean }) {
  const d = daysUntil(today, o);
  const tone = o.overdue ? "overdue" : d <= 7 ? "soon" : "later";
  return (
    <li className={first ? "" : "border-t border-raised"}>
      <Link href={o.href} className="flex min-h-15 items-center gap-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${tone === "overdue" ? "bg-status-overdue" : tone === "soon" ? "bg-status-soon-mark" : "bg-label"}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{o.title}</span>
          <span className="block truncate font-mono text-[10.5px] tracking-wide text-label uppercase">
            {o.kind === "electricity" ? "Electricity" : o.kind === "subscription" ? "Subscription" : "Bill"}
            {o.autopay ? " · autopay" : ""} · {formatDate(o.date)}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          {o.amount !== null ? <span className="font-mono text-[13px] font-semibold tabular-nums">{formatMoney(o.amount / 100)}</span> : null}
          <span className={`font-mono text-[10.5px] uppercase ${tone === "overdue" ? "text-status-overdue" : tone === "soon" ? "text-status-soon" : "text-muted-foreground"}`}>
            {describeDays(d)}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** What is overdue and what is due in the next few weeks, soonest first (restyled in R.5b, board HBills). */
export function UpcomingList({ occurrences, today, days }: { occurrences: Occurrence[]; today: string; days: number }) {
  return (
    <section aria-labelledby="upcoming-title" className="flex flex-col rounded-2xl border bg-card px-4 pt-3 pb-1">
      <h2 id="upcoming-title" className="font-mono text-[10.5px] font-normal tracking-[0.14em] text-label uppercase">
        Due
      </h2>
      <p className="pb-1 text-xs text-muted-foreground">Electricity bills show here too; they are managed on the Electricity page.</p>
      {occurrences.length === 0 ? (
        <p className="border-t border-raised py-3 text-sm text-muted-foreground">Nothing due in the next {days} days.</p>
      ) : (
        <>
          <ul>
            {occurrences.slice(0, SHOWN).map((o, i) => (
              <UpcomingRow key={o.key} o={o} today={today} first={i === 0} />
            ))}
          </ul>
          {occurrences.length > SHOWN ? (
            <details className="border-t border-raised">
              <summary className="cursor-pointer py-2.5 text-sm text-muted-foreground">Show {occurrences.length - SHOWN} more</summary>
              <ul>
                {occurrences.slice(SHOWN).map((o) => (
                  <UpcomingRow key={o.key} o={o} today={today} first={false} />
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}
