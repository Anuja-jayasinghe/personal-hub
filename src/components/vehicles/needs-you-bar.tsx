import Link from "next/link";
import { itemHref, nextUpWords, type Need, type NextUp } from "@/features/vehicles/overview";

/**
 * The "Needs you" bar at the top of the Overview (V.2, C149; design canvas "Vehicle overview"): what needs
 * attention, most urgent first, each with a link that opens its detail sheet; or, when nothing does, a calm
 * green "All clear" with what comes next. Only dates the reminders would also raise are here (`needsYou`), and a
 * type with no record at all is never "needs you". Pure markup: the page works the list out on the server.
 */

const mono = "font-mono text-[10.5px] tracking-[0.14em] uppercase md:text-[11px]";

export function NeedsYouBar({ needs, basePath }: { needs: readonly Need[]; basePath: string }) {
  const urgent = needs.some((n) => n.tone === "overdue");
  const box = urgent ? "border-status-overdue/50 bg-status-overdue-soft" : "border-status-soon-mark/45 bg-status-soon-soft";
  const ink = urgent ? "text-status-overdue" : "text-status-soon";
  const dot = urgent ? "bg-status-overdue" : "bg-status-soon-mark";

  return (
    <section aria-label="Needs you" className={`flex flex-col gap-1.5 rounded-2xl border px-4 py-3 md:flex-row md:items-start md:gap-4 md:px-5 md:py-3.5 ${box}`}>
      <span className="flex items-center gap-2 md:min-h-11 md:shrink-0">
        <span aria-hidden className={`size-2.5 rounded-full ${dot}`} />
        <span className={`${mono} ${ink}`}>Needs you{needs.length > 1 ? ` · ${needs.length}` : ""}</span>
      </span>
      <ul className="flex min-w-0 flex-1 flex-col divide-y divide-current/10">
        {needs.map((n) => (
          <li key={n.key}>
            <Link
              href={itemHref(basePath, n.item)}
              scroll={false}
              className="flex min-h-11 flex-col justify-center gap-0.5 rounded-lg py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex-row md:items-center md:gap-4"
            >
              <span className="text-[15px] font-semibold">{n.title}</span>
              <span className="text-[12.5px] text-muted-foreground md:flex-1 md:text-sm">{n.detail}</span>
              <span className={`hidden text-[13px] font-semibold md:inline ${ink}`}>Open →</span>
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
    <section aria-label="All clear" className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-status-ok/40 bg-status-ok-soft px-4 py-3 md:px-5 md:py-3.5">
      <span className="flex items-center gap-2">
        <span aria-hidden className="size-2.5 rounded-full bg-status-ok" />
        <span className={`${mono} text-status-ok`}>All clear</span>
      </span>
      <span className="text-[15px] font-semibold">Nothing needs attention.</span>
      {next ? <span className="text-sm text-muted-foreground">{nextUpWords(next)}</span> : null}
    </section>
  );
}
