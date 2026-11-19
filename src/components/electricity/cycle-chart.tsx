import type { CyclePoint } from "@/features/electricity/cycle";

export type CycleLine = {
  id: string;
  name: string;
  letter: string;
  /** CSS colour for this meter's line (from its tone). */
  stroke: string;
  points: CyclePoint[];
  /** What the whole cycle reaches at this pace, hundredths; null when there is no pace. */
  projected: number | null;
};

const W = 640;
const H = 170;
const PAD = { left: 6, right: 30, top: 14, bottom: 24 };

/**
 * The cycle chart (DESIGN.md, Other number pictures; board HElectricityDesktop): units used so far
 * this cycle per meter as node-and-line series against dashed 120 and 180 guide lines, with the pace
 * as a dashed line to the end of the cycle. x is days since each meter's last bill. All figures are
 * hundredths of a kWh.
 */
export function CycleChart({ lines, low, high, cycleDays }: { lines: CycleLine[]; low: number; high: number; cycleDays: number }) {
  const drawn = lines.filter((l) => l.points.length > 1);
  if (drawn.length === 0) return null;

  const top = Math.max(high / 0.85, ...drawn.flatMap((l) => l.points.map((p) => p.used)));
  const x = (day: number) => PAD.left + (Math.min(day, cycleDays) / cycleDays) * (W - PAD.left - PAD.right);
  const y = (used: number) => H - PAD.bottom - (Math.min(used, top) / top) * (H - PAD.top - PAD.bottom);
  const r = (n: number) => Math.round(n * 10) / 10;
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
              {l.points.slice(0, -1).map((p) => (
                <circle key={p.date} cx={r(x(p.day))} cy={r(y(p.used))} r={3.5} fill={l.stroke} />
              ))}
              <circle cx={r(x(last.day))} cy={r(y(last.used))} r={5.5} fill={l.stroke} stroke="var(--card)" strokeWidth={2.5} />
              <text x={r(x(last.day) + 8)} y={r(y(last.used) - 6)} fontSize={9} fontWeight={600} className="fill-foreground font-mono">
                {l.letter}
              </text>
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
