import { MeterTile } from "@/components/electricity/meter-tile";
import { MonthlyChart } from "@/components/electricity/monthly-chart";
import type { ElectricityBill, ElectricityMeter } from "@/db/schema";
import type { MeterData } from "@/features/electricity/meter-data";
import { checkNudge, type LastChecked } from "@/features/electricity/last-checked";
import type { LimitsResult } from "@/features/electricity/limits";
import { adviceLine, paceLine, type LimitUnits } from "@/features/electricity/limits-text";
import { unpaidTotal } from "@/features/electricity/overview";
import { formatMoney } from "@/lib/format";

/** The "Both" view (C78, C87): a tile per meter against its limit, the room left before a price jump with the pace check and any warning, what is still to pay, and the monthly chart. */
export function ElectricityOverview({
  meters,
  allMeters,
  bills,
  data,
  toneIndexOf,
  hrefFor,
  limits,
  units,
  nameOf,
  checks,
}: {
  meters: ElectricityMeter[];
  allMeters: ElectricityMeter[];
  bills: ElectricityBill[];
  data: Map<string, MeterData>;
  toneIndexOf: (id: string) => number;
  hrefFor: (id: string) => string;
  limits: LimitsResult;
  units: LimitUnits;
  nameOf: (id: string) => string;
  checks: Map<string, LastChecked>;
}) {
  const unpaid = unpaidTotal(bills.filter((b) => meters.some((m) => m.id === b.meterId)));
  const pace = paceLine(limits);
  const advice = adviceLine(limits.advice, limits, nameOf, units);
  const nudge = checkNudge(meters.map((m) => ({ name: m.name, check: checks.get(m.id)! })));
  const room = Math.floor(limits.headroom / 100);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {meters.map((m) => (
          <MeterTile key={m.id} meter={m} toneIndex={toneIndexOf(m.id)} data={data.get(m.id)!} href={hrefFor(m.id)} limit={limits.meters.find((l) => l.id === m.id)!} units={units} check={checks.get(m.id)!} />
        ))}
      </div>

      {advice ? (
        <p
          role={limits.advice?.kind === "over" ? "alert" : "status"}
          className={`rounded-xl px-4 py-3 text-sm ${
            limits.advice?.kind === "over"
              ? "bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-100"
              : "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100"
          }`}
        >
          {advice}
        </p>
      ) : null}

      {nudge ? (
        <p role="status" className="rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/20 dark:text-amber-100">
          {nudge}
        </p>
      ) : null}

      <dl className="flex flex-wrap gap-x-10 gap-y-3 px-1">
        <div>
          <dd className="text-xl font-medium tabular-nums">{room} units</dd>
          <dt className="text-sm text-muted-foreground">left before a price jump, both meters together</dt>
          {pace ? <p className={`mt-1 max-w-prose text-sm ${pace.tone === "warn" ? "text-amber-800 dark:text-amber-200" : "text-muted-foreground"}`}>{pace.text}</p> : null}
        </div>
        {unpaid.cents > 0 ? (
          <div>
            <dd className="text-xl font-medium tabular-nums">{formatMoney(unpaid.cents / 100)}</dd>
            <dt className="text-sm text-muted-foreground">to pay{unpaid.withoutAmount > 0 ? ` (plus ${unpaid.withoutAmount} bill without an amount)` : ""}</dt>
          </div>
        ) : null}
      </dl>

      <MonthlyChart meters={allMeters} bills={bills} />
    </div>
  );
}
