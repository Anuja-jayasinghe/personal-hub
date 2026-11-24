import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { itemHref, nextUpWords, type Need, type NextUp } from "@/features/vehicles/overview";

/**
 * The "Needs you" bar at the top of the Overview (V.2, C149; design canvas "Vehicle overview"): what needs
 * attention, most urgent first, each with a link that opens its detail sheet; or, when nothing does, a calm
 * green "All clear" with what comes next. Only dates the reminders would also raise are here (`needsYou`), and a
 * type with no record at all is never "needs you". Pure markup: the page works the list out on the server.
 * The look (issue #237): a tinted panel with a glowing state dot, the most urgent row in larger type, the
 * rest quieter, and an arrow chip at the end of each row.
 */

const mono = "font-mono text-[10.5px] tracking-[0.14em] uppercase md:text-[11px]";

export function NeedsYouBar({ needs, basePath }: { needs: readonly Need[]; basePath: string }) {
  const urgent = needs.some((n) => n.tone === "overdue");
  const box = urgent ? "border-status-overdue/50 bg-status-overdue-soft" : "border-status-soon-mark/45 bg-status-soon-soft";
  const ink = urgent ? "text-status-overdue" : "text-status-soon";
  const dot = urgent ? "bg-status-overdue shadow-[0_0_0_4px_color-mix(in_oklab,var(--status-overdue)_22%,transparent)]" : "bg-status-soon-mark shadow-[0_0_0_4px_color-mix(in_oklab,var(--status-soon-mark)_22%,transparent)]";
  const chip = urgent ? "border-status-overdue/45 text-status-overdue" : "border-status-soon-mark/45 text-status-soon";

  return (
    <section aria-label="Needs you" className={`flex flex-col gap-2 rounded-[20px] border px-4 py-3.5 lg:flex-row lg:items-start lg:gap-6 md:px-6 md:py-4 ${box}`}>
      <span className="flex items-center gap-2.5 lg:min-h-11 lg:w-36 lg:shrink-0">
        <span aria-hidden className={`size-2.5 rounded-full ${dot}`} />
        <span className={`${mono} ${ink}`}>Needs you{needs.length > 1 ? ` · ${needs.length}` : ""}</span>
      </span>
      <ul className="flex min-w-0 flex-1 flex-col divide-y divide-current/10">
        {needs.map((n, i) => (
          <li key={n.key}>
            <Link
              href={itemHref(basePath, n.item)}
              scroll={false}
              className="group/row flex min-h-11 items-center gap-3 rounded-lg py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring md:gap-4"
            >
              <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 lg:flex-row lg:items-baseline lg:justify-start lg:gap-4">
                <span className={`font-semibold ${i === 0 ? "text-base md:text-lg" : "text-[15px]"}`}>{n.title}</span>
                <span className="text-[12.5px] text-muted-foreground md:text-sm">{n.detail}</span>
              </span>
              <span aria-hidden className={`flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors group-hover/row:bg-foreground/10 ${chip}`}>
                <ArrowRight className="size-4" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "All clear. Next up: the emission test, in 292 days." in the calm green. */
export function AllClearBar({ next }: { next: NextUp | null }) {
  return (
    <section aria-label="All clear" className="flex items-center gap-3 rounded-[20px] border border-status-ok/40 bg-status-ok-soft px-4 py-3 md:px-6 md:py-3.5">
      <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full border border-status-ok/45 text-status-ok">
        <Check className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-4 gap-y-0.5">
        <span className={`${mono} text-status-ok`}>All clear</span>
        <span className="text-[15px] font-semibold">Nothing needs attention.</span>
        {next ? <span className="text-sm text-muted-foreground">{nextUpWords(next)}</span> : null}
      </span>
    </section>
  );
}
