import { MeterBadge, toneFor } from "@/components/electricity/meter-tone";
import { unitsByMonth } from "@/features/electricity/monthly";
import { badgeLetter } from "@/features/electricity/overview";
import type { ElectricityBill, ElectricityMeter } from "@/db/schema";
import { toCents } from "@/lib/decimal";
import { formatMonth } from "@/lib/format";

/**
 * Units per month, stacked by meter (C78). Plain CSS bars, no chart package. Each block carries its
 * meter's letter and each bar its total; hovering or focusing a month shows each meter's units (S.4). `meters` is every meter (active
 * and archived) in a stable order so a meter keeps its colour. Months with no bill stay as gaps.
 */
export function MonthlyChart({ meters, bills }: { meters: ElectricityMeter[]; bills: ElectricityBill[] }) {
  const bars = unitsByMonth(
    bills.map((b) => ({ meterId: b.meterId, readingDate: b.readingDate, units: toCents(b.units) })),
    meters.map((m) => m.id),
    6,
  );
  if (bars.length === 0) return null;

  const max = Math.max(...bars.map((b) => b.total));
  const indexOf = (id: string) => Math.max(0, meters.findIndex((m) => m.id === id));
  const letterOf = (id: string) => badgeLetter(meters.find((m) => m.id === id)?.name ?? "?");
  const nameOf = (id: string) => meters.find((m) => m.id === id)?.name ?? "Meter";
  const used = meters.filter((m) => bars.some((b) => b.segments.some((s) => s.meterId === m.id)));

  return (
    <section aria-labelledby="monthly-title" className="flex flex-col gap-3 rounded-2xl border bg-card p-4 md:px-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="monthly-title" className="text-sm font-semibold">
          Used each month
        </h2>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {used.map((m) => (
            <span key={m.id} className="flex items-center gap-1">
              <span aria-hidden className={`size-2.5 rounded-sm ${toneFor(indexOf(m.id)).bar}`} />
              <MeterBadge name={m.name} /> {m.name}
            </span>
          ))}
        </span>
      </div>

      <div className="flex h-44 items-end gap-4 border-b px-1 pt-2" role="group" aria-label="Units used each month, by meter. Focus a month to see each meter.">
        {bars.map((bar) => (
          <div
            key={bar.month}
            tabIndex={bar.total > 0 ? 0 : -1}
            aria-label={`${formatMonth(bar.month)}: ${Math.round(bar.total / 100)} kWh${bar.segments.map((sg) => `, ${nameOf(sg.meterId)} ${Math.round(sg.units / 100)}`).join("")}`}
            className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{bar.total > 0 ? Math.round(bar.total / 100) : "no bill"}</span>
            <div className="flex w-full max-w-14 flex-col-reverse overflow-hidden rounded-t-lg group-hover:brightness-110" style={{ height: `${max > 0 ? (bar.total / max) * 78 : 0}%` }}>
              {bar.segments.map((sg) => (
                <div
                  key={sg.meterId}
                  className={`flex items-center justify-center font-mono text-[11px] font-semibold ${toneFor(indexOf(sg.meterId)).bar}`}
                  style={{ height: `${(sg.units / bar.total) * 100}%` }}
                >
                  {letterOf(sg.meterId)}
                </div>
              ))}
            </div>
            {bar.total > 0 ? (
              <div
                aria-hidden
                className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 flex w-max -translate-x-1/2 flex-col gap-1 rounded-xl border bg-popover px-3 py-2 text-xs opacity-0 shadow-[0_12px_30px_-12px_rgb(0_0_0/0.7)] transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                <span className="font-mono text-[10px] tracking-[0.12em] text-label uppercase">{formatMonth(bar.month)}</span>
                {bar.segments.map((sg) => (
                  <span key={sg.meterId} className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-sm ${toneFor(indexOf(sg.meterId)).bar}`} />
                    <span className="flex-1 text-muted-foreground">{nameOf(sg.meterId)}</span>
                    <span className="font-mono font-semibold tabular-nums">{Math.round(sg.units / 100)}</span>
                  </span>
                ))}
                <span className="flex justify-between gap-4 border-t pt-1 font-mono text-[11px]">
                  <span className="text-label">TOTAL</span>
                  <span className="font-semibold tabular-nums">{Math.round(bar.total / 100)} kWh</span>
                </span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div aria-hidden className="flex gap-4 px-1">
        {bars.map((bar) => (
          <span key={bar.month} className="min-w-0 flex-1 truncate text-center font-mono text-[10.5px] text-label uppercase">
            {formatMonth(bar.month)}
          </span>
        ))}
      </div>
    </section>
  );
}
