import Link from "next/link";
import { LastCheckedLine } from "@/components/electricity/last-checked-line";
import { stateLamp } from "@/components/electricity/limit-chips";
import { MeterBadge } from "@/components/electricity/meter-tone";
import { readingDigits } from "@/features/electricity/cycle";
import type { LastChecked } from "@/features/electricity/last-checked";
import type { MeterLimit } from "@/features/electricity/limits";
import { leftHeadline, roleChip, type LimitUnits } from "@/features/electricity/limits-text";

export type BoardMeter = {
  id: string;
  name: string;
  href: string;
  limit: MeterLimit;
  check: LastChecked;
  /** The newest reading, hundredths of a kWh; null when there is none. */
  reading: number | null;
  /** True while current flows along its line: the live meter, or, while no meter is marked live, any meter with a pace. */
  flowing: boolean;
  /** True for the live meter, false for an idle one, null while no meter is marked live (issue #69). */
  live: boolean | null;
};

/**
 * The meter board (DESIGN.md, The meter board; boards HElectricity, HElectricityDesktop): a GRID node
 * feeding a line to each meter, on a deep panel. Each meter shows its letter, its job with a state
 * lamp, the last reading as dial digits, the units left in Oxanium, and when it was last read; the
 * whole module links to that meter. Once a meter is marked live (issue #69, C102) it says LIVE with a
 * blue lamp, the others IDLE, and current flows only to the live one; until then nothing says LIVE and
 * current flows to any meter that is being used.
 */
export function MeterBoard({ meters, units }: { meters: BoardMeter[]; units: LimitUnits }) {
  const n = meters.length;
  const cols = Math.min(n, 3);
  // The connector only lines up with the modules when they sit in one row.
  const showLines = n >= 1 && n <= 3;

  return (
    <section
      aria-label="The meter board"
      className="rounded-3xl border border-raised bg-deepest bg-[radial-gradient(var(--card)_1px,transparent_1px)] bg-size-[14px_14px] p-3 pt-2.5 md:p-5"
    >
      {showLines ? (
        <div aria-hidden className="relative h-10">
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
            {meters.map((m, i) => {
              const x = ((i + 0.5) / cols) * 100;
              const d = `M50 10V22H${x}V40`;
              return (
                <g key={m.id}>
                  <path d={d} fill="none" stroke={m.flowing ? "var(--primary)" : "var(--border)"} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  {m.flowing ? (
                    <path
                      d={d}
                      fill="none"
                      stroke="var(--foreground)"
                      strokeWidth={2.4}
                      strokeDasharray="2 18"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                      className="motion-safe:animate-[hub-flow_0.8s_linear_infinite]"
                    />
                  ) : null}
                </g>
              );
            })}
          </svg>
          <span className="absolute top-[10px] left-1/2 size-2.5 -translate-1/2 rounded-full bg-primary" />
          <span className="absolute top-[4px] left-[calc(50%+12px)] font-mono text-[9px] tracking-[0.14em] text-label">GRID</span>
        </div>
      ) : null}

      <div className="grid gap-2.5 md:gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {meters.map((m) => (
          <MeterModule key={m.id} meter={m} units={units} />
        ))}
      </div>
    </section>
  );
}

function MeterModule({ meter, units }: { meter: BoardMeter; units: LimitUnits }) {
  const { limit } = meter;
  const headline = limit.known ? leftHeadline(limit) : null;
  const digits = meter.reading === null ? null : readingDigits(meter.reading);

  return (
    <Link
      href={meter.href}
      className={`flex flex-col items-center gap-2.5 rounded-2xl bg-card px-2 py-3 text-card-foreground ring-1 outline-none transition-colors hover:ring-primary/60 focus-visible:ring-2 focus-visible:ring-ring md:gap-3.5 md:py-5 ${
        meter.flowing ? "ring-primary/45" : "ring-border"
      }`}
    >
      <span className="flex w-full items-center justify-between gap-2 px-1">
        <MeterBadge name={meter.name} />
        <span className="flex min-w-0 items-center gap-1.5 font-mono text-[10px] tracking-wide text-label">
          <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${stateLamp[limit.state]}`} />
          <span className="truncate">{roleChip(limit.role, units)}</span>
        </span>
      </span>

      {meter.live !== null ? (
        <span className={`flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.16em] ${meter.live ? "text-primary" : "text-label"}`}>
          <span
            aria-hidden
            className={`size-1.5 rounded-full ${meter.live ? "bg-primary shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_25%,transparent)]" : "bg-quiet"}`}
          />
          {meter.live ? "LIVE" : "IDLE"}
        </span>
      ) : null}

      {digits ? (
        <span role="img" aria-label={`Last reading ${digits.join("")}`} className="flex gap-0.5">
          {digits.map((d, i) => (
            <span
              key={i}
              className={`flex h-7 w-5 items-center justify-center rounded-[5px] font-mono text-[15px] font-semibold md:h-10 md:w-7 md:text-[22px] ${
                i === digits.length - 1
                  ? meter.live === false
                    ? "bg-quiet text-foreground"
                    : "bg-primary text-primary-foreground"
                  : "bg-raised text-foreground"
              }`}
            >
              {d}
            </span>
          ))}
        </span>
      ) : (
        <span className="font-mono text-[11px] text-label">no reading yet</span>
      )}

      <span className="flex items-baseline gap-1.5">
        {headline ? (
          <>
            <span className="font-display text-[38px] leading-none font-semibold tracking-tight md:text-5xl">{headline.value}</span>
            <span className="text-xs text-muted-foreground">{headline.label === "left" ? `to ${Math.round(limit.limit / 100)}` : "over"}</span>
          </>
        ) : (
          <span className="font-display text-[38px] leading-none font-semibold text-quiet md:text-5xl">–</span>
        )}
      </span>
      <span className="sr-only">
        {meter.name}
        {meter.live === true ? ", live" : meter.live === false ? ", idle" : ""}
      </span>
      <LastCheckedLine check={meter.check} />
    </Link>
  );
}
