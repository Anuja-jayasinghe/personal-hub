import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { whenLabel, type NeedRow } from "@/features/home/home";

/** How many rows show; the rest are on the Reminders page, one link away. */
const SHOWN = 6;

/**
 * "Needs you" on Home (issue #218, C157): the tinted state panel of the vehicle Overview (red while anything is
 * late, amber otherwise), the most urgent row in larger type, an arrow chip at the end of each row. Only what is
 * late or due within a week, plus a meter read once it is due. With nothing, Home does not draw it: the greeting
 * already says "All clear" (an empty box would say the same thing twice).
 */
export function NeedsPanel({ needs, className = "" }: { needs: readonly NeedRow[]; className?: string }) {
  if (needs.length === 0) return null;
  const urgent = needs.some((n) => n.daysUntil < 0);
  const box = urgent ? "border-status-overdue/50 bg-status-overdue-soft" : "border-status-soon-mark/45 bg-status-soon-soft";
  const ink = urgent ? "text-status-overdue" : "text-status-soon";
  const chip = urgent ? "border-status-overdue/45 text-status-overdue" : "border-status-soon-mark/45 text-status-soon";
  const shown = needs.slice(0, SHOWN);
  const more = needs.length - shown.length;
  return (
    <section aria-labelledby="needs-title" className={`flex flex-col gap-1 rounded-[20px] border px-4 py-3.5 md:px-5 md:py-4 ${box} ${className}`}>
      <h2 id="needs-title" className={`flex items-center gap-2.5 font-mono text-[10.5px] font-normal tracking-[0.14em] uppercase md:text-[11px] ${ink}`}>
        <span aria-hidden className={`size-2 rounded-full ${urgent ? "bg-status-overdue" : "bg-status-soon-mark"}`} />
        Needs you · {needs.length}
      </h2>
      <ul className="flex flex-col divide-y divide-current/10">
        {shown.map((n, i) => (
          <li key={n.key}>
            <Link href={n.href} className="group/row flex min-h-14 items-center gap-3 rounded-lg py-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring md:gap-4">
              <span className="min-w-0 flex-1">
                <span className={`line-clamp-2 block leading-snug font-semibold ${i === 0 ? "text-base md:text-lg" : "text-[15px]"}`}>{n.label}</span>
                <span className="mt-0.5 flex flex-wrap gap-x-2 font-mono text-[10.5px] tracking-[0.06em] text-muted-foreground uppercase">
                  <span className={n.daysUntil < 0 ? "text-status-overdue" : ""}>{whenLabel(n.daysUntil, n.date)}</span>
                  <span aria-hidden>·</span>
                  <span className="truncate">{n.sub}</span>
                </span>
              </span>
              <span aria-hidden className={`flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors group-hover/row:bg-foreground/10 ${chip}`}>
                <ArrowRight className="size-4" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {more > 0 ? (
        <Link href="/reminders" className="hit-44 self-start text-sm font-semibold text-primary hover:underline">
          {more} more in Reminders
        </Link>
      ) : null}
    </section>
  );
}
