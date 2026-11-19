import Link from "next/link";
import { LastCheckedLine } from "@/components/electricity/last-checked-line";
import { stateLamp } from "@/components/electricity/limit-chips";
import { MeterBadge } from "@/components/electricity/meter-tone";
import { readingDigits } from "@/features/electricity/cycle";
import { dialArc, dialPoint, dialTicks, gaugeTop, type Dial } from "@/features/electricity/gauge";
import type { LastChecked } from "@/features/electricity/last-checked";
import type { MeterState } from "@/features/electricity/limits";

export type InstrumentMeter = {
  id: string;
  name: string;
  /** Where the instrument links; none on the one-meter page. */
  href?: string;
  /** Used since the last bill, hundredths of a kWh; null when it cannot be known yet. */
  used: number | null;
  /** Where the cycle ends at this pace, hundredths; null without a pace. */
  projected: number | null;
  state: MeterState;
  /** True for the live meter, false for an idle one, null while no meter is marked live (#69). */
  live: boolean | null;
  /** The newest reading, hundredths; null when there is none. */
  reading: number | null;
  check: LastChecked;
  /** The meter's job in words ("33 to 120", "Allowed to 180"). */
  role: string;
};

const STROKE = { ok: "var(--primary)", near: "var(--status-soon-mark)", over: "var(--status-overdue)" } as const;

/**
 * The meter instrument (S.4, C109; design board "Electricity: the meter instrument"). One dial per
 * meter replaces both the old meter module and the separate slab line, so the same numbers are not
 * shown twice: the arc is units used this cycle, the dashed needle is where the pace leads by the end
 * of the cycle, amber marks the low slab and red the high one. Under it, the units used in Oxanium,
 * the reading as dial digits, and when it was last read. Units only: prices come with the tariff.
 */
export function MeterInstrument({
  meter,
  low,
  high,
  size = "md",
  showName = true,
}: {
  meter: InstrumentMeter;
  low: number;
  high: number;
  size?: "md" | "lg";
  /** Off on the one-meter tab, where the page already names the meter. */
  showName?: boolean;
}) {
  const dial: Dial = { cx: 130, cy: 120, r: 96, top: gaugeTop(high) };
  const used = meter.used === null ? null : meter.used / 100;
  const pace = meter.projected === null ? null : meter.projected / 100;
  const stroke = STROKE[meter.state];
  // The needles stop short of the scale numbers so they never cover them.
  const needle = used === null ? null : dialPoint(dial, used, dial.r - 40);
  const paceTip = pace === null ? null : dialPoint(dial, pace, dial.r - 40);
  const paceLabel = pace === null ? null : dialPoint(dial, pace, dial.r + 17);
  const labels = [
    { v: 0, fill: "var(--label)" },
    { v: low, fill: "var(--status-soon)" },
    { v: high, fill: "var(--status-overdue)" },
  ];
  const digits = meter.reading === null ? null : readingDigits(meter.reading);
  const words = `${meter.name}: ${used === null ? "not counting yet" : `${Math.round(used)} units used this cycle`}${pace !== null ? `, on pace for about ${Math.round(pace)}` : ""}${meter.live === true ? ", live" : meter.live === false ? ", idle" : ""}. ${meter.role}.`;

  const body = (
    <>
      <span className="flex items-center gap-2.5">
        {showName ? (
          <>
            <MeterBadge name={meter.name} className="h-6 min-w-7 text-xs" />
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{meter.name}</span>
          </>
        ) : (
          <span className="flex-1" />
        )}
        {meter.live !== null ? (
          <span className={`flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.16em] ${meter.live ? "text-primary" : "text-label"}`}>
            <span aria-hidden className={`size-1.5 rounded-full ${meter.live ? "bg-primary" : "bg-quiet"}`} />
            {meter.live ? "LIVE" : "IDLE"}
          </span>
        ) : null}
      </span>

      <span className="relative block">
        <svg viewBox="0 0 260 200" className="w-full" aria-hidden>
          <path d={dialArc(dial, 0, dial.top)} fill="none" stroke="var(--raised)" strokeWidth={10} strokeLinecap="round" />
          <path d={dialArc(dial, low, high, dial.r + 9)} fill="none" stroke="var(--status-soon-mark)" strokeWidth={3} strokeLinecap="round" opacity={0.9} />
          <path d={dialArc(dial, high, dial.top, dial.r + 9)} fill="none" stroke="var(--status-overdue)" strokeWidth={3} strokeLinecap="round" />
          <path d={dialTicks(dial, 20, dial.r - 12, dial.r - 6)} fill="none" stroke="var(--quiet)" strokeWidth={1.5} />
          {used !== null && used > 0 ? <path d={dialArc(dial, 0, used)} fill="none" stroke={stroke} strokeWidth={10} strokeLinecap="round" /> : null}
          {paceTip ? (
            <line x1={dial.cx} y1={dial.cy} x2={paceTip.x} y2={paceTip.y} stroke={stroke} strokeWidth={2} strokeDasharray="3 5" strokeLinecap="round" opacity={0.55} />
          ) : null}
          {needle ? <line x1={dial.cx} y1={dial.cy} x2={needle.x} y2={needle.y} stroke="var(--foreground)" strokeWidth={3} strokeLinecap="round" /> : null}
          <circle cx={dial.cx} cy={dial.cy} r={9} fill="var(--card)" stroke={stroke} strokeWidth={3} />
          {needle ? <circle cx={needle.x} cy={needle.y} r={4} fill="var(--foreground)" /> : null}
          {labels.map((l) => {
            const p = dialPoint(dial, l.v, dial.r - 26);
            return (
              <text key={l.v} x={p.x} y={p.y + 3} textAnchor="middle" fontSize={10} fill={l.fill} className="font-mono">
                {l.v}
              </text>
            );
          })}
          {paceLabel && pace !== null ? (
            <text x={paceLabel.x} y={paceLabel.y + 3} textAnchor="middle" fontSize={9.5} fill={stroke} className="font-mono">
              ~{Math.round(pace)}
            </text>
          ) : null}
        </svg>
        <span className="absolute inset-x-0 bottom-[6%] flex items-baseline justify-center gap-1.5">
          <span className={`font-display leading-none font-semibold tracking-tight ${size === "lg" ? "text-6xl md:text-7xl" : "text-4xl md:text-[52px]"} ${used === null ? "text-quiet" : ""}`}>
            {used === null ? "–" : Math.round(used)}
          </span>
          <span className="text-xs text-muted-foreground">{used === null ? "no reading yet" : "used"}</span>
        </span>
      </span>

      {digits ? (
        <span className="flex justify-center gap-0.5" aria-hidden>
          {digits.map((d, i) => (
            <span
              key={i}
              className={`flex h-7 w-5 items-center justify-center rounded-[5px] font-mono text-[15px] font-semibold md:h-8 md:w-6 md:text-base ${
                i === digits.length - 1 ? (meter.live === false ? "bg-quiet text-foreground" : "bg-primary text-primary-foreground") : "bg-raised text-foreground"
              }`}
            >
              {d}
            </span>
          ))}
        </span>
      ) : null}

      <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-wide text-label">
          <span aria-hidden className={`size-1.5 rounded-full ${stateLamp[meter.state]}`} />
          {meter.role}
        </span>
        <LastCheckedLine check={meter.check} />
      </span>
    </>
  );

  const frame = `flex flex-col gap-2 rounded-3xl border bg-deepest bg-[radial-gradient(var(--card)_1px,transparent_1px)] bg-size-[14px_14px] p-3 md:gap-2.5 md:p-5 ${
    meter.live ? "border-primary/45" : "border-raised"
  }`;
  return meter.href ? (
    <Link href={meter.href} aria-label={words} className={`${frame} outline-none hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring`}>
      {body}
    </Link>
  ) : (
    <section aria-label={words} className={frame}>
      {body}
    </section>
  );
}
