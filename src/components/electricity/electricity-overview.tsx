import { MeterTile } from "@/components/electricity/meter-tile";
import { MonthlyChart } from "@/components/electricity/monthly-chart";
import type { ElectricityBill, ElectricityMeter } from "@/db/schema";
import type { MeterData } from "@/features/electricity/meter-data";
import { kwhParts, unpaidTotal } from "@/features/electricity/overview";
import { combineUsage } from "@/features/electricity/since-bill";
import { formatMoney } from "@/lib/format";

/** The "Both" view (C78): one tile per meter, the two totals that matter, and the monthly chart. Nothing else. */
export function ElectricityOverview({
  meters,
  allMeters,
  bills,
  data,
  toneIndexOf,
  hrefFor,
}: {
  meters: ElectricityMeter[];
  allMeters: ElectricityMeter[];
  bills: ElectricityBill[];
  data: Map<string, MeterData>;
  toneIndexOf: (id: string) => number;
  hrefFor: (id: string) => string;
}) {
  const together = meters.length > 1 ? combineUsage(meters.map((m) => data.get(m.id)!.usage)) : null;
  const unpaid = unpaidTotal(bills.filter((b) => meters.some((m) => m.id === b.meterId)));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {meters.map((m) => (
          <MeterTile key={m.id} meter={m} toneIndex={toneIndexOf(m.id)} data={data.get(m.id)!} href={hrefFor(m.id)} />
        ))}
      </div>

      {together || unpaid.cents > 0 ? (
        <dl className="flex flex-wrap gap-x-10 gap-y-3 px-1">
          {together ? (
            <div>
              <dd className="text-xl font-medium tabular-nums">{kwhParts(together.units).value} kWh</dd>
              <dt className="text-sm text-muted-foreground">
                together since the last bills{together.counted < together.of ? ` (${together.counted} of ${together.of} meters)` : ""}
              </dt>
            </div>
          ) : null}
          {unpaid.cents > 0 ? (
            <div>
              <dd className="text-xl font-medium tabular-nums">{formatMoney(unpaid.cents / 100)}</dd>
              <dt className="text-sm text-muted-foreground">to pay{unpaid.withoutAmount > 0 ? ` (plus ${unpaid.withoutAmount} bill without an amount)` : ""}</dt>
            </div>
          ) : null}
        </dl>
      ) : null}

      <MonthlyChart meters={allMeters} bills={bills} />
    </div>
  );
}
