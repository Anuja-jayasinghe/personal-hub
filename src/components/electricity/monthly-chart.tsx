import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listAllBills, listMeters } from "@/features/electricity/queries";
import { unitsByMonth } from "@/features/electricity/monthly";
import { formatKwh } from "@/features/electricity/usage";
import { toCents } from "@/lib/decimal";
import { formatMonth } from "@/lib/format";

// Same hue, five lightness steps (theme.css): meters are told apart by the legend and the table too, not by colour alone.
const SEGMENT_CLASSES = ["bg-chart-2", "bg-chart-4", "bg-chart-1", "bg-chart-3", "bg-chart-5"];

/** Units per month from the bills, stacked by meter. Plain CSS bars, no chart package. Use inside <Suspense>. */
export async function MonthlyChart() {
  const [active, archived, bills] = await Promise.all([listMeters(false), listMeters(true), listAllBills()]);
  const meters = [...active, ...archived];
  const bars = unitsByMonth(
    bills.map((b) => ({ meterId: b.meterId, readingDate: b.readingDate, units: toCents(b.units) })),
    meters.map((m) => m.id),
  );
  if (bars.length === 0) return null;

  const max = Math.max(...bars.map((b) => b.total));
  const usedIds = new Set(bars.flatMap((b) => b.segments.map((s) => s.meterId)));
  const legend = meters.filter((m) => usedIds.has(m.id));
  const nameOf = (id: string) => meters.find((m) => m.id === id)?.name ?? "Meter";
  const classOf = (id: string) => SEGMENT_CLASSES[meters.findIndex((m) => m.id === id) % SEGMENT_CLASSES.length];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="size-4" aria-hidden /> Monthly usage
        </CardTitle>
        <CardDescription>Units on your bills, in the month of each bill&apos;s reading date (last 12 months).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div
          role="img"
          aria-label={`Bar chart of units per month. Highest month: ${formatKwh(max)}. Open "Show as a table" for every value.`}
          className="flex h-44 items-end gap-1 border-b"
        >
          {bars.map((bar) => (
            <div key={bar.month} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${formatMonth(bar.month)}: ${formatKwh(bar.total)}`}>
              <span className="mb-0.5 text-center text-[10px] leading-none text-muted-foreground">{bar.total > 0 ? Math.round(bar.total / 100) : ""}</span>
              <div className="flex flex-col-reverse" style={{ height: `${max > 0 ? (bar.total / max) * 85 : 0}%` }}>
                {bar.segments.map((s) => (
                  <div key={s.meterId} className={`${classOf(s.meterId)} ring-1 ring-background`} style={{ height: `${(s.units / bar.total) * 100}%` }} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div aria-hidden className="flex gap-1">
          {bars.map((bar) => (
            <span key={bar.month} className="min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground">
              {formatMonth(bar.month).replace(" ", " ")}
            </span>
          ))}
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {legend.map((m) => (
            <li key={m.id} className="flex items-center gap-1.5">
              <span aria-hidden className={`size-3 rounded-sm ${classOf(m.id)}`} />
              {m.name}
            </li>
          ))}
          <li>Numbers above the bars are whole kWh.</li>
        </ul>

        <details className="rounded-md border">
          <summary className="cursor-pointer px-3 py-1.5 text-sm text-muted-foreground">Show as a table</summary>
          <div className="overflow-x-auto border-t">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-3 py-1.5 font-medium">Month</th>
                  <th scope="col" className="px-3 py-1.5 font-medium">Total</th>
                  <th scope="col" className="px-3 py-1.5 font-medium">By meter</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...bars].reverse().map((bar) => (
                  <tr key={bar.month}>
                    <th scope="row" className="px-3 py-1.5 text-left font-medium">{formatMonth(bar.month)}</th>
                    <td className="px-3 py-1.5">{formatKwh(bar.total)}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {bar.segments.length === 0 ? "No bill" : bar.segments.map((s) => `${nameOf(s.meterId)} ${formatKwh(s.units)}`).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
