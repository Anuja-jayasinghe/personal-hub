import Link from "next/link";
import { whenLabel, type TimelineItem } from "@/features/home/home";

const lamp = { overdue: "bg-status-overdue", due: "bg-status-soon-mark", check: "bg-label" } as const;
const whenText = { overdue: "text-status-overdue", due: "text-foreground", check: "text-muted-foreground" } as const;

export type NextItem = TimelineItem & { date: string; sub: string };

/** "Needs you next" (boards HHomePhone, HHome): the most urgent few, each with a lamp, a line under it and when. */
export function NeedsYouNext({ items }: { items: NextItem[] }) {
  return (
    <section aria-labelledby="needs-title" className="flex flex-col rounded-2xl border bg-card px-4 pt-3 pb-1">
      <h2 id="needs-title" className="pb-1 font-mono text-[10.5px] font-normal tracking-[0.14em] text-label uppercase">
        Needs you next
      </h2>
      {items.length === 0 ? (
        <p className="border-t border-raised py-3 text-sm text-muted-foreground">Nothing needs you right now.</p>
      ) : (
        <ul>
          {items.map((i) => (
            <li key={i.key} className="border-t border-raised">
              <Link href={i.href} className="flex min-h-15 items-center gap-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${lamp[i.tone]}`} />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[15px] leading-snug font-semibold">{i.label}</span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{i.sub}</span>
                </span>
                <span className={`shrink-0 font-mono text-[10.5px] ${whenText[i.tone]}`}>{whenLabel(i.daysUntil, i.date)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
