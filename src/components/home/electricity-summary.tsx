import Link from "next/link";
import { MeterBadge } from "@/components/electricity/meter-tone";
import { SlabRule } from "@/components/electricity/slab-rule";
import type { ElectricitySnapshot } from "@/features/electricity/snapshot";
import { adviceLine, leftHeadline, paceLine } from "@/features/electricity/limits-text";

/**
 * Home's electricity card (boards HHomePhone, HHome): the room left before a price jump, a small slab
 * rule per meter with its units left (the live one marked, issue #69), and the warning or the pace.
 * The whole card opens Electricity (one link stretched over it), and `action` (Read the meters) sits in
 * its top corner above that link (S.1, owner's list item 5).
 */
export function ElectricitySummary({ snapshot, action }: { snapshot: ElectricitySnapshot; action?: React.ReactNode }) {
  const { meters, data, limits, units, live } = snapshot;
  const room = Math.floor(limits.headroom / 100);
  const nameOf = (id: string) => meters.find((m) => m.id === id)?.name ?? "Meter";
  const advice = adviceLine(limits.advice, limits, nameOf, units, live?.meterId ?? null);
  const pace = paceLine(limits);
  const note = advice ?? pace?.text ?? null;
  const warn = advice !== null || pace?.tone === "warn";

  return (
    <section
      aria-label="Electricity"
      className="relative flex flex-col gap-3.5 rounded-3xl border border-raised bg-[radial-gradient(120%_90%_at_85%_0%,color-mix(in_oklab,var(--primary)_14%,var(--deepest))_0%,var(--deepest)_60%)] p-4 has-[>div>a:hover]:border-primary/50 has-[>div>a:focus-visible]:ring-2 has-[>div>a:focus-visible]:ring-ring md:p-6"
    >
      <div className="flex min-h-8 items-center gap-3">
        <Link
          href="/electricity"
          aria-label={`Electricity: ${room} units before a price jump`}
          className="font-mono text-[10.5px] tracking-[0.14em] text-label uppercase outline-none after:absolute after:inset-0 after:rounded-3xl"
        >
          / Electricity
        </Link>
        {action ? <div className="relative z-10 ml-auto">{action}</div> : null}
      </div>
      <span className="flex items-end gap-3">
        <span className="font-display text-[64px] leading-[0.85] font-semibold tracking-tight md:text-8xl">{room}</span>
        <span className="pb-1 text-sm leading-snug text-muted-foreground">
          units before
          <br />a price jump
        </span>
      </span>

      <span className="flex flex-col gap-1.5">
        {meters.map((m) => {
          const limit = limits.meters.find((l) => l.id === m.id)!;
          const d = data.get(m.id)!;
          const headline = limit.known ? leftHeadline(limit) : null;
          return (
            <span key={m.id} className="flex items-center gap-2.5">
              <span className={`flex shrink-0 flex-col items-start gap-0.5 ${live ? "w-11" : ""}`}>
                <MeterBadge name={m.name} />
                {live ? (
                  <span className={`font-mono text-[8.5px] font-semibold tracking-[0.14em] ${live.meterId === m.id ? "text-primary" : "text-label"}`}>
                    {live.meterId === m.id ? "LIVE" : "IDLE"}
                  </span>
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <SlabRule
                  used={limit.used}
                  projected={d.usage.state === "ok" ? d.usage.projected : null}
                  low={units.low * 100}
                  high={units.high * 100}
                  state={limit.state}
                  size="sm"
                />
              </span>
              <span className="w-16 shrink-0 text-right">
                {headline ? (
                  <>
                    <span className="font-display text-lg font-semibold">{headline.value}</span>
                    <span className="text-[10px] text-label"> {headline.label}</span>
                  </>
                ) : (
                  <span className="text-xs text-label">–</span>
                )}
              </span>
            </span>
          );
        })}
      </span>

      {note ? (
        <span className={`flex gap-2 text-sm leading-relaxed ${warn ? "text-status-soon" : "text-muted-foreground"}`}>
          <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${warn ? "bg-status-soon-mark" : "bg-status-ok"}`} />
          {note}
        </span>
      ) : null}
    </section>
  );
}
