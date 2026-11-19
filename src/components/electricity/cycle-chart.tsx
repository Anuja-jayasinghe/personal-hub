import type { CyclePoint } from "@/features/electricity/cycle";
import type { ReadingRow } from "@/features/electricity/overview";
import { formatDate } from "@/lib/format";

export type CycleLine = {
  id: string;
  name: string;
  letter: string;
  /** CSS colour for this meter's line (from its tone). */
  stroke: string;
  points: CyclePoint[];
  /** The meter's readings, to show what the dial said at each point (S.4). */
  readings?: ReadingRow[];
  /** What the whole cycle reaches at this pace, hundredths; null when there is no pace. */
  projected: number | null;
};

const W = 1200;
const H = 230;
const PAD = { left: 6, right: 30, top: 22, bottom: 24 };

/**
 * The cycle chart (DESIGN.md, Other number pictures; board HElectricityDesktop): units used so far
 * this cycle per meter as node-and-line series against dashed 120 and 180 guide lines, with the pace
 * as a dashed line to the end of the cycle. x is days since each meter's last bill. Every reading is a
 * node with its units since the bill written next to it (the first meter's above the line, the next
 * below) and a tip with the date and the dial reading; the newest says "now" (S.4, owner's item 15).
 * All figures are hundredths of a kWh.
 */
export function CycleChart({ lines, low, high, cycleDays }: { lines: CycleLine[]; low: number; high: number; cycleDays: number }) {
  const drawn = lines.filter((l) => l.points.length > 1);
  if (drawn.length === 0) return null;

  const top = Math.max(high / 0.85, ...drawn.flatMap((l) => l.points.map((p) => p.used)));
  const x = (day: number) => PAD.left + (Math.min(day, cycleDays) / cycleDays) * (W - PAD.left - PAD.right);
  const y = (used: number) => H - PAD.bottom - (Math.min(used, top) / top) * (H - PAD.top - PAD.bottom);
  const r = (n: number) => Math.round(n * 10) / 10;
  // The line that is higher at its newest reading gets its labels above, the others below, so they do not collide.
  const highestId = [...drawn].sort((a, b) => b.points.at(-1)!.used - a.points.at(-1)!.used)[0]?.id;
  const label = drawn
    .map((l) => {
      const last = l.points.at(-1)!;
      return `${l.name}: ${Math.round(last.used / 100)} units by day ${last.day}${l.projected !== null ? `, on pace for about ${Math.round(l.projected / 100)}` : ""}`;
    })
    .join("; ");

  return (
    <section aria-labelledby="cycle-title" className="flex flex-col gap-2 rounded-2xl border bg-card p-4 md:px-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <h2 id="cycle-title" className="text-sm font-semibold">
          This cycle
        </h2>
        {drawn.map((l) => (
          <span key={l.id} className="flex items-center gap-1.5 text-muted-foreground">
            <span aria-hidden className="h-[3px] w-3.5 rounded-full" style={{ background: l.stroke }} />
            {l.name}
          </span>
        ))}
        <span className="ml-auto font-mono text-[10px] tracking-[0.14em] text-label">KWH</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Units used so far this cycle. ${label}.`}>
        <line x1={PAD.left} x2={W - PAD.right} y1={y(high)} y2={y(high)} stroke="var(--status-overdue)" strokeWidth={1} strokeDasharray="2 4" opacity={0.8} />
        <text x={W - PAD.right + 4} y={r(y(high) + 3)} fontSize={9} className="fill-status-overdue font-mono">
          {high / 100}
        </text>
        <line x1={PAD.left} x2={W - PAD.right} y1={y(low)} y2={y(low)} stroke="var(--status-soon-mark)" strokeWidth={1} strokeDasharray="2 4" opacity={0.8} />
        <text x={W - PAD.right + 4} y={r(y(low) + 3)} fontSize={9} className="fill-status-soon font-mono">
          {low / 100}
        </text>
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--border)" />

        {drawn.map((l) => {
          const pts = l.points.map((p) => `${r(x(p.day))},${r(y(p.used))}`).join(" ");
          const last = l.points.at(-1)!;
          return (
            <g key={l.id}>
              <polyline points={pts} fill="none" stroke={l.stroke} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
              {l.projected !== null && last.day < cycleDays ? (
                <line
                  x1={r(x(last.day))}
                  y1={r(y(last.used))}
                  x2={r(x(cycleDays))}
                  y2={r(y(l.projected))}
                  stroke={l.stroke}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  className="motion-safe:animate-[hub-flow_1.2s_linear_infinite]"
                />
              ) : null}
              {l.points.map((p, i) => {
                const isLast = i === l.points.length - 1;
                const reading = l.readings?.find((rr) => rr.date === p.date);
                const tip = `${l.name} · ${formatDate(p.date)}: ${Math.round(p.used / 100)} units since the bill${reading ? ` · the dial read ${Math.round(reading.value / 100).toLocaleString("en-LK")}` : ""}`;
                const above = l.id === highestId;
                return (
                  <g key={p.date}>
                    <circle cx={r(x(p.day))} cy={r(y(p.used))} r={isLast ? 5.5 : 3.5} fill={l.stroke} stroke={isLast ? "var(--card)" : "none"} strokeWidth={isLast ? 2.5 : 0} />
                    {i > 0 ? (
                      <text
                        x={r(x(p.day))}
                        y={r(y(p.used) + (above ? -9 : 15))}
                        textAnchor="middle"
                        fontSize={isLast ? 10 : 8.5}
                        fontWeight={isLast ? 700 : 500}
                        className={`font-mono ${isLast ? "fill-foreground" : "fill-label"}`}
                      >
                        {isLast ? `${l.letter} ${Math.round(p.used / 100)} now` : Math.round(p.used / 100)}
                      </text>
                    ) : null}
                    <circle cx={r(x(p.day))} cy={r(y(p.used))} r={9} fill="transparent">
                      <title>{tip}</title>
                    </circle>
                  </g>
                );
              })}
            </g>
          );
        })}

        <text x={PAD.left} y={H - 6} fontSize={9} className="fill-label font-mono">
          BILL
        </text>
        <text x={W - PAD.right} y={H - 6} fontSize={9} textAnchor="end" className="fill-label font-mono">
          DAY {cycleDays}
        </text>
      </svg>
    </section>
  );
}
