import { MeterBadge, toneFor } from "@/components/electricity/meter-tone";
import { unitsByMonth } from "@/features/electricity/monthly";
import { badgeLetter } from "@/features/electricity/overview";
import type { ElectricityBill, ElectricityMeter } from "@/db/schema";
import { toCents } from "@/lib/decimal";
import { formatMonth } from "@/lib/format";

/**
 * Units per month, stacked by meter (C78). Plain CSS bars, no chart package. Each block carries its
 * meter's letter and each bar its total, so nothing needs a legend. `meters` is every meter (active
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

      <div className="flex h-44 items-end gap-4 border-b px-1" role="group" aria-label="Units used each month, by meter">
        {bars.map((bar) => (
          <div key={bar.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{bar.total > 0 ? Math.round(bar.total / 100) : "no bill"}</span>
            <div className="flex w-full max-w-14 flex-col-reverse overflow-hidden rounded-t-lg" style={{ height: `${max > 0 ? (bar.total / max) * 78 : 0}%` }}>
              {bar.segments.map((s) => (
                <div
                  key={s.meterId}
                  className={`flex items-center justify-center font-mono text-[11px] font-semibold ${toneFor(indexOf(s.meterId)).bar}`}
                  style={{ height: `${(s.units / bar.total) * 100}%` }}
                  title={`${meters.find((m) => m.id === s.meterId)?.name}: ${Math.round(s.units / 100)} kWh`}
                >
                  {letterOf(s.meterId)}
                </div>
              ))}
            </div>
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
