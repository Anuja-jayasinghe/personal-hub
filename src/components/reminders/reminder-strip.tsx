import { emptyDot, ledFill, todayRing } from "@/components/shared/circuit";
import type { StripDay } from "@/features/reminders/strip";
import { formatDate } from "@/lib/format";

/**
 * The three-week strip at the top of Reminders (R.5b; S.5b, C111: the same circuit look as the Bills
 * calendar). One trace, a node per day from today: an empty day is a small dot, a day with things due
 * lights up and grows with how many (blue, amber from three, red when something is late), today is a
 * blue ring. On a phone the 21 days wrap into three rows of seven.
 */
export function ReminderStrip({ strip }: { strip: StripDay[] }) {
  const inStrip = strip.reduce((s, d) => s + d.due, 0);
  return (
    <section aria-label="The next three weeks" className="flex flex-col gap-3 rounded-3xl border border-raised bg-deepest p-3.5 md:p-5">
      <p className="flex items-baseline gap-2 px-0.5">
        <span className="font-display text-3xl leading-none font-semibold">{inStrip}</span>
        <span className="text-sm text-muted-foreground">{inStrip === 1 ? "thing" : "things"} in the next 3 weeks</span>
      </p>
      <ol className="grid grid-cols-7 gap-y-2 md:grid-cols-21">
        {strip.map((d, i) => {
          const isToday = i === 0;
          const tone = d.late > 0 ? "late" : d.due >= 3 ? "due" : d.due > 0 ? "soon" : null;
          const size = d.due === 0 ? "size-1.5" : d.due === 1 ? "size-3" : d.due === 2 ? "size-3.5" : "size-4";
          return (
            <li
              key={d.date}
              aria-label={`${formatDate(d.date)}: ${d.due === 0 ? "nothing due" : `${d.due} due${d.late ? `, ${d.late} late` : ""}`}`}
              className="flex flex-col items-center gap-1"
            >
              <span aria-hidden className={`font-mono text-[9.5px] ${isToday ? "text-primary" : "text-label"}`}>
                {d.weekday}
              </span>
              <span aria-hidden className={`font-mono text-[10px] ${isToday ? "font-semibold text-primary" : "text-quiet"}`}>
                {d.n}
              </span>
              <span aria-hidden className="relative flex h-5 w-full items-center justify-center">
                <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-raised" />
                <span className={`relative rounded-full ${tone ? `${size} ${ledFill[tone]}` : isToday ? `size-3 ${todayRing}` : `${size} ${emptyDot}`} ${tone && isToday ? "ring-2 ring-primary ring-offset-2 ring-offset-deepest" : ""}`} />
              </span>
              <span aria-hidden className={`h-3 font-mono text-[10px] leading-none ${d.late ? "text-status-overdue" : d.due >= 3 ? "text-status-soon" : "text-muted-foreground"}`}>
                {d.due > 0 ? d.due : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
