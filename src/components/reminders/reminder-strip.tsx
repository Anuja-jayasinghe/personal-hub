import type { StripDay } from "@/features/reminders/strip";
import { formatDate } from "@/lib/format";

/**
 * The three-week strip at the top of Reminders (R.5b, board HReminders): a cell per day from today,
 * today highlighted, a dot for each thing due (red when late), and the total above.
 */
export function ReminderStrip({ strip }: { strip: StripDay[] }) {
  const inStrip = strip.reduce((s, d) => s + d.due, 0);
  return (
    <section aria-label="The next three weeks" className="flex flex-col gap-3 rounded-3xl border border-raised bg-deepest p-3.5 md:p-5">
      <p className="flex items-baseline gap-2 px-0.5">
        <span className="font-display text-3xl leading-none font-semibold">{inStrip}</span>
        <span className="text-sm text-muted-foreground">{inStrip === 1 ? "thing" : "things"} in the next 3 weeks</span>
      </p>
      <ol className="grid grid-cols-7 gap-1">
        {strip.map((d, i) => (
          <li
            key={d.date}
            aria-label={`${formatDate(d.date)}: ${d.due === 0 ? "nothing due" : `${d.due} due${d.late ? `, ${d.late} late` : ""}`}`}
            className={`flex flex-col items-center gap-1 rounded-[10px] py-1.5 ${i === 0 ? "bg-accent ring-1 ring-primary/55" : ""}`}
          >
            <span aria-hidden className={`font-mono text-[9px] ${i === 0 ? "text-muted-foreground" : "text-quiet"}`}>
              {d.weekday}
            </span>
            <span aria-hidden className={`font-display text-[15px] ${i === 0 ? "font-bold" : "font-medium text-muted-foreground"}`}>
              {d.n}
            </span>
            <span aria-hidden className="flex h-1.5 gap-0.5">
              {Array.from({ length: Math.min(d.due, 3) }, (_, k) => (
                <span key={k} className={`size-1.5 rounded-full ${k < d.late ? "bg-status-overdue" : i === 0 ? "bg-status-soon-mark" : "bg-primary"}`} />
              ))}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
