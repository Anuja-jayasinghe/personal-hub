import Link from "next/link";
import { DaysRing } from "@/components/shared/days-ring";
import { itemHref, kmGlanceWords, type GlanceCard } from "@/features/vehicles/overview";

/**
 * The at-a-glance cards of the Overview (V.2, C149), soonest first: the oil-change marker and each current
 * renewal, each a days ring (green normally, amber inside 30 days, red inside 7 or late) with its date. The oil
 * card also shows the km driven since that service as a glance (nothing reminds by km, C24). A card opens its
 * detail sheet; the "nothing recorded" oil card only says so. Two columns on a phone, as many as fit on a wide screen.
 */

const EDGE = { ok: "border-border", soon: "border-status-soon-mark/45", overdue: "border-status-overdue/50" } as const;
/** The soonest card is tinted with its own state, so the eye lands on it first. */
const TINT = { ok: "bg-card", soon: "bg-status-soon-soft", overdue: "bg-status-overdue-soft" } as const;
const FILL = { ok: "bg-status-ok", soon: "bg-status-soon-mark", overdue: "bg-status-overdue" } as const;
const mono = "font-mono text-[10.5px] text-label uppercase md:text-[11px]";

export function GlanceCards({ cards, basePath }: { cards: readonly GlanceCard[]; basePath: string }) {
  if (cards.length === 0) return null;
  return (
    <section aria-label="At a glance" className="grid grid-cols-2 gap-2.5 md:grid-cols-[repeat(auto-fit,minmax(230px,1fr))] md:gap-3.5">
      {cards.map((c, i) => {
        const edge = c.tone ? EDGE[c.tone] : "border-border";
        // Only the first card (the soonest) and only when it has a date to be soon about.
        const lead = i === 0 && c.days !== null && c.tone !== null && c.tone !== "ok";
        const body = (
          <>
            <span className="flex items-center gap-3 md:gap-4">
              {c.days !== null ? <DaysRing days={c.days} ofDays={c.span} size={64} bare label={c.label} className="size-[52px] md:size-16" /> : null}
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-sm leading-tight font-semibold md:text-[15px]">{c.title}</span>
                {c.dateLine ? <span className={mono}>{c.dateLine}</span> : null}
              </span>
            </span>
            {c.km ? (
              <span className="mt-auto flex flex-col gap-1.5 border-t border-border/60 pt-2.5">
                <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-raised">
                  <span className={`block h-full rounded-full ${FILL[c.tone ?? "ok"]}`} style={{ width: `${Math.round(c.km.share * 100)}%` }} />
                </span>
                <span className={mono}>{kmGlanceWords(c.km)}</span>
              </span>
            ) : c.sub ? (
              <span className={`mt-auto border-t border-border/60 pt-2.5 text-[12.5px] text-muted-foreground ${c.days === null ? "" : "hidden md:block"} truncate`}>{c.sub}</span>
            ) : null}
          </>
        );
        const cls = `flex flex-col gap-3 rounded-[18px] border p-3.5 text-card-foreground md:min-h-[140px] md:rounded-[20px] md:p-[18px] ${edge} ${lead && c.tone ? TINT[c.tone] : "bg-card"}`;
        return c.item ? (
          <Link key={c.key} href={itemHref(basePath, c.item)} scroll={false} aria-label={c.label} className={`${cls} outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring`}>
            {body}
          </Link>
        ) : (
          <div key={c.key} className={`${cls} border-dashed`}>
            {body}
          </div>
        );
      })}
    </section>
  );
}
