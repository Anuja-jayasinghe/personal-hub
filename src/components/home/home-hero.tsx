import type { ReactNode } from "react";
import type { HomeBrief } from "@/features/home/home";

const TONE = {
  overdue: { dot: "bg-status-overdue shadow-[0_0_0_4px_color-mix(in_oklab,var(--status-overdue)_22%,transparent)]", glow: "color-mix(in oklab, var(--status-overdue) 9%, transparent)" },
  soon: { dot: "bg-status-soon-mark shadow-[0_0_0_4px_color-mix(in_oklab,var(--status-soon-mark)_22%,transparent)]", glow: "color-mix(in oklab, var(--status-soon-mark) 8%, transparent)" },
  ok: { dot: "bg-status-ok shadow-[0_0_0_4px_color-mix(in_oklab,var(--status-ok)_20%,transparent)]", glow: "color-mix(in oklab, var(--status-ok) 8%, transparent)" },
} as const;
const CHIP = {
  overdue: "border-status-overdue/45 bg-status-overdue-soft text-status-overdue",
  soon: "border-status-soon-mark/45 bg-status-soon-soft text-status-soon",
} as const;

/**
 * The top of Home (issue #218, C157): the greeting, then one line saying how the day stands (how many things
 * need you, split into late / this week / meter reads / the slab rule, or a calm "All clear" with what comes
 * next). The panel is the vehicle hero's language (deepest floor, a 14 px dot grid fading to the right, a faint
 * glow low on the left tinted by the state). `children` is the right-hand side on a wide screen (the 30-day line)
 * and sits under the text on a phone. Pure markup: the page works the brief out on the server.
 */
export function HomeHero({ greeting, brief, children }: { greeting: string; brief: HomeBrief; children?: ReactNode }) {
  const t = TONE[brief.tone];
  return (
    <section aria-label="Today" className="relative isolate overflow-hidden rounded-3xl border border-border bg-deepest p-5 dark:border-raised md:p-8">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: `radial-gradient(60% 80% at 8% 100%, ${t.glow}, transparent 70%), radial-gradient(40% 60% at 95% 0%, color-mix(in oklab, var(--primary) 9%, transparent), transparent 70%)` }} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_right,black,transparent_60%)] [background-image:radial-gradient(color-mix(in_oklab,var(--border)_85%,transparent)_1px,transparent_1.5px)] [background-size:14px_14px]"
      />
      <div className={`grid gap-6 ${children ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-stretch lg:gap-10" : ""}`}>
        <div className="flex flex-col gap-4 md:gap-5 lg:justify-center">
          <div className="flex flex-col gap-4 md:gap-5">
          <h1 className="text-[28px] leading-tight font-normal tracking-tight text-balance md:text-5xl md:leading-[1.05] md:font-light">{greeting}</h1>
          <div className="flex flex-col gap-2.5">
            <p className="flex items-center gap-3">
              <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${t.dot}`} />
              <span className="text-lg leading-snug font-semibold md:text-xl">{brief.headline}</span>
            </p>
            {brief.chips.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {brief.chips.map((c) => (
                  <li key={c.text} className={`rounded-full border px-3 py-1 font-mono text-[11px] tracking-[0.06em] ${CHIP[c.tone]}`}>
                    {c.text}
                  </li>
                ))}
              </ul>
            ) : null}
            {brief.nextUp ? <p className="text-sm text-muted-foreground md:text-base">{brief.nextUp}</p> : null}
          </div>
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}
