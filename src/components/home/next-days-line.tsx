import Link from "next/link";
import { placeLabels, whenLabel, type TimelineDay } from "@/features/home/home";

const node = { overdue: "bg-status-overdue-soft ring-status-overdue", due: "bg-status-soon-soft ring-status-soon-mark", check: "bg-card ring-label" } as const;
const text = { overdue: "text-status-overdue", due: "text-status-soon", check: "text-muted-foreground" } as const;

/** The narrowest the line gets (a phone); labels are placed for this width so they never overlap. */
const LINE_PX = 320;

/**
 * The next 30 days as a line (DESIGN.md, Other number pictures; boards HHomePhone, HHome): today as a
 * blue node, a node for each day with something on it (red if overdue, amber for bills and renewals,
 * grey for a meter read), and a short label above or below, left out where it would collide. The full
 * list of the same items is there for screen readers, and "Needs you next" shows the nearest ones.
 */
export function NextDaysLine({
  days,
  windowDays,
  title,
  link = { href: "/reminders", label: "Reminders" },
}: {
  days: TimelineDay[];
  windowDays: number;
  /** Defaults to "Next N days". */
  title?: string;
  /** The link at the top right; null for none. */
  link?: { href: string; label: string } | null;
}) {
  const at = (day: number) => `${(day / windowDays) * 100}%`;
  const toneOf = (d: TimelineDay) => (d.items.some((i) => i.tone === "overdue") ? "overdue" : d.items.some((i) => i.tone === "due") ? "due" : "check");
  const labels = placeLabels(days, windowDays, LINE_PX);

  return (
    <section aria-labelledby="next-days-title" className="flex flex-col gap-2 rounded-2xl border bg-card px-4 pt-3 pb-2.5">
      <div className="flex items-baseline">
        <h2 id="next-days-title" className="font-mono text-[10.5px] font-normal tracking-[0.14em] text-label uppercase">
          {title ?? `Next ${windowDays} days`}
        </h2>
        {link ? (
          <Link href={link.href} className="ml-auto text-xs font-semibold text-primary hover:underline">
            {link.label}
          </Link>
        ) : null}
      </div>

      {days.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Nothing due in the next {windowDays} days.</p>
      ) : (
        <>
          <div aria-hidden className="relative mx-2 h-16">
            <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-border" />
            {days[0].day !== 0 ? <span className="absolute top-1/2 left-0 size-3 -translate-1/2 rounded-full bg-primary ring-2 ring-card" /> : null}
            {days.map((d, i) => {
              const tone = toneOf(d);
              const label = labels[i];
              const pct = d.day / windowDays;
              const align = pct > 0.85 ? "-translate-x-full" : pct < 0.1 ? "-translate-x-1" : "-translate-x-1/2";
              return (
                <span key={d.day}>
                  {label.lane ? (
                    <span
                      className={`absolute h-2.5 w-px bg-border ${label.lane === "up" ? "bottom-1/2 mb-1.5" : "top-1/2 mt-1.5"}`}
                      style={{ left: at(d.day) }}
                    />
                  ) : null}
                  <span
                    className={`absolute top-1/2 size-3 -translate-1/2 rounded-full ring-2 ${d.day === 0 && tone === "check" ? "bg-primary ring-primary" : node[tone]}`}
                    style={{ left: at(d.day) }}
                  />
                  {label.text ? (
                    <span
                      className={`absolute font-mono text-[9.5px] leading-none whitespace-nowrap ${text[tone]} ${label.lane === "up" ? "top-0" : "bottom-0"} ${align}`}
                      style={{ left: at(d.day) }}
                    >
                      {label.text}
                    </span>
                  ) : null}
                </span>
              );
            })}
          </div>
          <div aria-hidden className="flex justify-between font-mono text-[9.5px] text-label">
            <span className="text-foreground">TODAY</span>
            <span>+{windowDays} DAYS</span>
          </div>
          <ul className="sr-only">
            {days.flatMap((d) =>
              d.items.map((i) => (
                <li key={i.key}>
                  {i.label}, {whenLabel(i.daysUntil, d.date).toLowerCase()}
                </li>
              )),
            )}
          </ul>
        </>
      )}
    </section>
  );
}
