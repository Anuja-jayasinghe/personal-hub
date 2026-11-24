import Link from "next/link";
import { MeterBadge, toneFor } from "@/components/electricity/meter-tone";
import { gaugeTop, ringPoint, ringShare } from "@/features/electricity/gauge";
import type { ElectricitySnapshot } from "@/features/electricity/snapshot";
import { checkedText } from "@/features/electricity/last-checked";
import { adviceLine, paceLine, roomText } from "@/features/electricity/limits-text";

const STATE_STROKE = { near: "var(--status-soon-mark)", over: "var(--status-overdue)" } as const;

/**
 * Home's electricity card (S.4, C109; design board "Home: usage rings"): one ring per meter on the same
 * scale as the instrument (once round = the dial top), with the low and high slabs marked, and the units
 * used on all meters in the middle. It is deliberately not a copy of the Electricity instrument. Beside
 * it each meter's units and LIVE / IDLE, then the warning when there is one. Units only: prices come
 * with the tariff. The whole card opens Electricity (one stretched link) and `action` (Read the meters)
 * sits in its top corner above that link (S.1).
 */
export function ElectricitySummary({ snapshot, action }: { snapshot: ElectricitySnapshot; action?: React.ReactNode }) {
  const { meters, limits, units, live } = snapshot;
  const nameOf = (id: string) => meters.find((m) => m.id === id)?.name ?? "Meter";
  const advice = adviceLine(limits.advice, limits, nameOf, units, live?.meterId ?? null);
  const pace = paceLine(limits);
  const top = gaugeTop(units.high);
  const rows = meters.slice(0, 3).map((m, i) => {
    const limit = limits.meters.find((l) => l.id === m.id)!;
    const used = limit.known ? limit.used / 100 : null;
    const stroke = limit.state === "ok" ? toneFor(i).stroke : STATE_STROKE[limit.state];
    return { m, limit, used, stroke, isLive: live?.meterId === m.id, radius: 116 - i * 26 };
  });
  const total = Math.round(rows.reduce((sum, r) => sum + (r.used ?? 0), 0));
  const words = `Electricity: ${total} units used this cycle. ${rows.map((r) => `${r.m.name} ${r.used === null ? "not counting yet" : `${Math.round(r.used)} used`}`).join(", ")}.`;

  return (
    <section
      aria-label="Electricity"
      className="relative flex h-full flex-col gap-3.5 rounded-3xl border border-border dark:border-raised bg-[radial-gradient(120%_90%_at_85%_0%,color-mix(in_oklab,var(--primary)_14%,var(--deepest))_0%,var(--deepest)_60%)] p-4 has-[>div>a:hover]:border-primary/50 has-[>div>a:focus-visible]:ring-2 has-[>div>a:focus-visible]:ring-ring md:p-6"
    >
      <div className="flex min-h-8 items-center gap-3">
        <Link href="/electricity" aria-label={words} className="font-mono text-[10.5px] tracking-[0.14em] text-label uppercase outline-none after:absolute after:inset-0 after:rounded-3xl">
          / Electricity
        </Link>
        {action ? <div className="relative z-10 ml-auto">{action}</div> : null}
      </div>

      <div className="flex flex-1 flex-wrap items-center gap-x-8 gap-y-4 md:py-2">
        <svg viewBox="0 0 260 260" className="size-44 shrink-0 md:size-56" aria-hidden>
          {rows.map((r) => {
            const c = 2 * Math.PI * r.radius;
            const share = r.used === null ? 0 : ringShare(r.used, top);
            const end = ringPoint(130, 130, r.radius, share);
            const lowMark = ringPoint(130, 130, r.radius, ringShare(units.low, top));
            const highMark = ringPoint(130, 130, r.radius, ringShare(units.high, top));
            return (
              <g key={r.m.id}>
                <circle cx={130} cy={130} r={r.radius} fill="none" stroke="var(--card)" strokeWidth={15} />
                {share > 0 ? (
                  <circle
                    cx={130}
                    cy={130}
                    r={r.radius}
                    fill="none"
                    stroke={r.stroke}
                    strokeWidth={15}
                    strokeLinecap="round"
                    strokeDasharray={`${(c * share).toFixed(1)} ${c.toFixed(1)}`}
                    transform="rotate(-90 130 130)"
                  />
                ) : null}
                <circle cx={lowMark.x} cy={lowMark.y} r={3.2} fill="var(--deepest)" stroke="var(--status-soon-mark)" strokeWidth={2} />
                <circle cx={highMark.x} cy={highMark.y} r={3.2} fill="var(--deepest)" stroke="var(--status-overdue)" strokeWidth={2} />
                {share > 0 ? <circle cx={end.x} cy={end.y} r={r.isLive ? 8.5 : 6.5} fill={r.stroke} stroke="var(--deepest)" strokeWidth={3} /> : null}
              </g>
            );
          })}
          <text x={130} y={134} textAnchor="middle" fontSize={56} fontWeight={600} className="fill-foreground font-display">
            {total}
          </text>
          <text x={130} y={160} textAnchor="middle" fontSize={10} letterSpacing={1.4} className="fill-label font-mono">
            UNITS USED
          </text>
        </svg>

        <div className="flex min-w-48 max-w-md flex-1 flex-col gap-3">
          {rows.map((r) => (
            <div key={r.m.id} className="flex items-center gap-3">
              <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: r.stroke }} />
              <MeterBadge name={r.m.name} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold">
                  {r.m.name}
                  {live ? (
                    <span className={`ml-2 font-mono text-[9.5px] font-semibold tracking-[0.14em] ${r.isLive ? "text-primary" : "text-label"}`}>{r.isLive ? "LIVE" : "IDLE"}</span>
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {roomText(r.limit, units)}
                  {snapshot.checks.get(r.m.id) ? ` · ${checkedText(snapshot.checks.get(r.m.id)!).toLowerCase()}` : ""}
                </span>
              </span>
              <span className="font-display text-2xl font-semibold tabular-nums">{r.used === null ? "–" : Math.round(r.used)}</span>
            </div>
          ))}
          {pace ? <p className={`text-xs leading-relaxed ${pace.tone === "warn" ? "text-status-soon" : "text-muted-foreground"}`}>{pace.text}</p> : null}
          {advice ? (
            <p className="flex gap-2 text-sm leading-relaxed text-status-soon">
              <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-status-soon-mark" />
              {advice}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
