import { Check } from "lucide-react";
import Link from "next/link";
import { DaysRing } from "@/components/shared/days-ring";
import { daysWords, type AreaGlance } from "@/features/home/home";

const meta = {
  vehicles: { label: "Vehicles", href: "/vehicles", noun: "vehicle" },
  bills: { label: "Bills", href: "/bills", noun: "bill" },
  tasks: { label: "Tasks", href: "/tasks", noun: "task" },
} as const;

const mono = "font-mono text-[10.5px] tracking-[0.14em] uppercase md:text-[11px]";

/**
 * One glance per area that is on and that the person may see (issue #218, C157; replaces the three number tiles).
 * The soonest thing due in the window sits in a days ring, in the Overview's own colours (green, amber inside 30
 * days, red inside 7 or late), with its name and "in 3 days"; it opens that item. The title row opens the area.
 * An area with nothing due says so in one quiet green line instead of a large "0". The cards stay neutral (the
 * tinted panel is "Needs you"); the ring and a red "late" carry the state.
 */
export function AreaGlances({ areas, windowDays, className = "" }: { areas: readonly AreaGlance[]; windowDays: number; className?: string }) {
  if (areas.length === 0) return null;
  return (
    <div className={className}>
      {areas.map((g) => {
        const m = meta[g.area];
        const s = g.soonest;
        const late = s !== null && s.daysUntil < 0;
        const more = g.due - 1;
        const subject = g.area === "vehicles" && g.records > 1 ? `${g.records} vehicles` : null;
        return (
          <section key={g.area} aria-label={m.label} className={`flex flex-col justify-center rounded-[20px] border border-border bg-card p-3.5 md:px-4 md:py-3`}>
            <Link href={m.href} className={`hit-44 -m-1 flex min-h-9 items-center justify-between gap-3 rounded-lg p-1 text-label outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring ${mono}`}>
              <span>{m.label}</span>
              {g.overdue > 0 ? <span className="text-status-overdue">{g.overdue} late</span> : s ? <span>{g.due} due</span> : null}
            </Link>
            {s ? (
              <Link
                href={s.href}
                className="mt-1 flex items-center gap-3.5 rounded-lg py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring md:gap-4"
              >
                <DaysRing days={s.daysUntil} ofDays={windowDays} size={64} bare label={`${s.title}, ${daysWords(s.daysUntil)}`} className="size-[52px] md:size-14" />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="line-clamp-2 text-[15px] leading-snug font-semibold">{s.title}</span>
                  <span className={`${mono} ${late ? "text-status-overdue" : "text-muted-foreground"}`}>
                    {s.daysUntil < 0 ? `${-s.daysUntil} ${-s.daysUntil === 1 ? "day" : "days"} late` : daysWords(s.daysUntil)}
                    {more > 0 ? ` · +${more} more${subject ? `, ${subject}` : ""}` : ""}
                  </span>
                </span>
              </Link>
            ) : (
              <p className="mt-1 flex items-center gap-3 py-1.5 text-sm text-muted-foreground">
                <span aria-hidden className="flex size-[30px] shrink-0 items-center justify-center rounded-full border border-status-ok/45 text-status-ok">
                  <Check className="size-4" />
                </span>
                Nothing due in {windowDays} days.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
