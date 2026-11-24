import { pointKey, type OdometerPoint, type OdometerSource } from "@/features/vehicles/odometer";
import { daysBetween } from "@/lib/dates";
import { formatDate } from "@/lib/format";

/**
 * The mileage timeline (issue #181), in the hub's node-and-line language: km over time through every
 * value that fits, each point's marker shape saying where it came from (ring = a reading typed on the
 * Odometer section, square = a service, diamond = an emission test certificate). A value that doesn't
 * fit the history is drawn in the overdue colour, off the line. The legend is shown once; the history
 * list under it uses the same markers (`SourceMarker`), so the source is read from the shape alone.
 */

const W = 640;
const H = 170;
const PAD = { left: 8, right: 8, top: 26, bottom: 26 };
const km = (n: number) => `${n.toLocaleString("en-LK")} km`;
const r1 = (n: number) => Math.round(n * 10) / 10;

export const SOURCE_NAMES: Record<OdometerSource, string> = { reading: "Reading", service: "Service", emission: "Emission test" };

/** One point's marker, centred on (x, y): its shape is its source; `unfit` paints it in the overdue colour. */
function Marker({ source, x, y, size = 5, unfit = false }: { source: OdometerSource; x: number; y: number; size?: number; unfit?: boolean }) {
  const colour = unfit ? "var(--status-overdue)" : source === "emission" ? "var(--chart-3)" : "var(--primary)";
  if (source === "reading") return <circle cx={x} cy={y} r={size - 0.75} fill="var(--card)" stroke={colour} strokeWidth={1.75} />;
  if (source === "service") return <rect x={x - size + 0.5} y={y - size + 0.5} width={(size - 0.5) * 2} height={(size - 0.5) * 2} rx={1} fill={colour} />;
  const d = size + 1;
  return <path d={`M${x} ${y - d} L${x + d} ${y} L${x} ${y + d} L${x - d} ${y} Z`} fill={colour} />;
}

/** The marker on its own, for the legend and the start of each history row. */
export function SourceMarker({ source, unfit = false, className = "" }: { source: OdometerSource; unfit?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 14 14" className={`size-3.5 shrink-0 ${className}`} aria-hidden focusable="false">
      <Marker source={source} x={7} y={7} unfit={unfit} />
    </svg>
  );
}

export function OdometerTimeline({ points, unfit }: { points: readonly OdometerPoint[]; unfit: ReadonlySet<string> }) {
  if (points.length < 2) return null;
  const fitting = points.filter((p) => !unfit.has(pointKey(p)));
  const first = points[0].date;
  const last = points[points.length - 1].date;
  const span = Math.max(1, daysBetween(first, last));
  const lo = Math.min(...points.map((p) => p.km));
  const hi = Math.max(...points.map((p) => p.km));
  const range = Math.max(1, hi - lo);
  const x = (date: string) => r1(PAD.left + (daysBetween(first, date) / span) * (W - PAD.left - PAD.right));
  const y = (n: number) => r1(H - PAD.bottom - ((n - lo) / range) * (H - PAD.top - PAD.bottom));

  // A tick at each 1 January inside the range, labelled with its year.
  const years: { year: number; at: number }[] = [];
  for (let year = Number(first.slice(0, 4)) + 1; year <= Number(last.slice(0, 4)); year++) years.push({ year, at: x(`${year}-01-01`) });
  const sources = [...new Set(points.map((p) => p.source))];
  const newest = fitting.at(-1);
  const oldest = fitting[0];

  return (
    <figure className="flex flex-col gap-2" data-no-gesture>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Odometer from ${km(lo)} on ${formatDate(first)} to ${km(hi)} on ${formatDate(last)}, ${points.length} values`}
      >
        {years.map((t) => (
          <g key={t.year}>
            <line x1={t.at} x2={t.at} y1={PAD.top - 8} y2={H - PAD.bottom} stroke="var(--raised)" strokeWidth={1} />
            {/* Near the right edge the label sits on the left of its tick, so it is not cut off. */}
            <text x={t.at > W - 40 ? t.at - 4 : t.at + 4} y={H - 8} fontSize={10} textAnchor={t.at > W - 40 ? "end" : "start"} fill="var(--label)" fontFamily="var(--font-mono)">
              {t.year}
            </text>
          </g>
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="var(--raised)" strokeWidth={1} />
        {fitting.length > 1 ? (
          <polyline points={fitting.map((p) => `${x(p.date)},${y(p.km)}`).join(" ")} fill="none" stroke="var(--primary)" strokeWidth={1.5} strokeLinejoin="round" opacity={0.7} />
        ) : null}
        {points.map((p) => {
          const bad = unfit.has(pointKey(p));
          return (
            <g key={pointKey(p)}>
              <title>{`${formatDate(p.date)} · ${km(p.km)} · ${SOURCE_NAMES[p.source]}${p.label ? ` · ${p.label}` : ""}${bad ? " · doesn't fit" : ""}`}</title>
              <Marker source={p.source} x={x(p.date)} y={y(p.km)} unfit={bad} />
            </g>
          );
        })}
        {oldest && newest && oldest !== newest ? (
          <>
            <text x={x(oldest.date)} y={y(oldest.km) - 10} fontSize={10.5} fill="var(--label)" fontFamily="var(--font-mono)">
              {oldest.km.toLocaleString("en-LK")}
            </text>
            <text x={x(newest.date)} y={y(newest.km) - 10} fontSize={11} fontWeight={600} textAnchor="end" fill="currentColor" fontFamily="var(--font-mono)">
              {newest.km.toLocaleString("en-LK")} km
            </text>
          </>
        ) : null}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px] tracking-wide text-label uppercase">
        {sources.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <SourceMarker source={s} />
            {SOURCE_NAMES[s]}
          </span>
        ))}
        {unfit.size > 0 ? (
          <span className="flex items-center gap-1.5 text-status-overdue">
            <SourceMarker source={points.find((p) => unfit.has(pointKey(p)))!.source} unfit />
            Doesn&apos;t fit
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
