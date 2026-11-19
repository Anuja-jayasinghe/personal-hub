import Link from "next/link";
import { MeterBadge } from "@/components/electricity/meter-tone";
import { SlabRule } from "@/components/electricity/slab-rule";
import type { ElectricitySnapshot } from "@/features/electricity/snapshot";
import { adviceLine, leftHeadline, paceLine } from "@/features/electricity/limits-text";

/**
 * Home's electricity card (boards HHomePhone, HHome): the room left before a price jump, a small slab
 * rule per meter with its units left, and the warning or the pace. The whole card opens Electricity.
 */
export function ElectricitySummary({ snapshot }: { snapshot: ElectricitySnapshot }) {
  const { meters, data, limits, units } = snapshot;
  const room = Math.floor(limits.headroom / 100);
  const nameOf = (id: string) => meters.find((m) => m.id === id)?.name ?? "Meter";
  const advice = adviceLine(limits.advice, limits, nameOf, units);
  const pace = paceLine(limits);
  const note = advice ?? pace?.text ?? null;
  const warn = advice !== null || pace?.tone === "warn";

  return (
    <Link
      href="/electricity"
      aria-label={`Electricity: ${room} units before a price jump`}
      className="flex flex-col gap-3.5 rounded-3xl border border-raised bg-[radial-gradient(120%_90%_at_85%_0%,color-mix(in_oklab,var(--primary)_14%,var(--deepest))_0%,var(--deepest)_60%)] p-4 outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring md:p-6"
    >
      <span className="font-mono text-[10.5px] tracking-[0.14em] text-label uppercase">/ Electricity</span>
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
              <MeterBadge name={m.name} />
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
    </Link>
  );
}
