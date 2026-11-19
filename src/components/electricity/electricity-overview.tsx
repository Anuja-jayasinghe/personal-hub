import Link from "next/link";
import { CycleChart } from "@/components/electricity/cycle-chart";
import { MeterBoard } from "@/components/electricity/meter-board";
import { toneFor } from "@/components/electricity/meter-tone";
import { MonthlyChart } from "@/components/electricity/monthly-chart";
import type { ElectricityBill, ElectricityMeter } from "@/db/schema";
import type { MeterData } from "@/features/electricity/meter-data";
import { checkNudge, type LastChecked } from "@/features/electricity/last-checked";
import type { LimitsResult } from "@/features/electricity/limits";
import type { LiveMeter } from "@/features/electricity/live";
import { adviceLine, roomText, type LimitUnits } from "@/features/electricity/limits-text";
import { badgeLetter, unpaidTotal } from "@/features/electricity/overview";
import { formatMoney } from "@/lib/format";

/** A short note in a state colour: amber for "near" or a due check, red for "over". */
function Note({ tone, children, role = "status" }: { tone: "near" | "over"; children: React.ReactNode; role?: "status" | "alert" }) {
  return (
    <p
      role={role}
      className={`flex gap-2.5 rounded-xl px-4 py-3 text-sm leading-relaxed ${tone === "over" ? "bg-status-overdue-soft text-status-overdue" : "bg-status-soon-soft text-status-soon"}`}
    >
      <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${tone === "over" ? "bg-status-overdue" : "bg-status-soon-mark"}`} />
      <span>{children}</span>
    </p>
  );
}

/**
 * The "Both" view (C78, C87; R.3a; S.4, C109): one instrument per meter, the units used this cycle on
 * all meters together (units only until the tariff is added), any warning, what is still to pay (it
 * opens Bills), the cycle chart with every reading on wide screens, and the monthly chart.
 */
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
  live,
  cycleDays,
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
  live: LiveMeter | null;
  cycleDays: number;
}) {
  const unpaid = unpaidTotal(bills.filter((b) => meters.some((m) => m.id === b.meterId)));
  const advice = adviceLine(limits.advice, limits, nameOf, units, live?.meterId ?? null);
  const nudge = checkNudge(meters.map((m) => ({ name: m.name, check: checks.get(m.id)! })));
  const limitOf = (id: string) => limits.meters.find((l) => l.id === id)!;
  const counting = meters.filter((m) => limitOf(m.id).known);
  const totalUsed = Math.round(counting.reduce((sum, m) => sum + limitOf(m.id).used, 0) / 100);

  // Phone: one column in reading order. Wide windows (lg): the instruments over two columns with the
  // total, the warnings and what is to pay beside them, then the cycle chart and the monthly chart.
  return (
    <div className="flex flex-col gap-3 md:gap-5">
      <div className="grid gap-3 md:gap-5 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <MeterBoard
            low={units.low}
            high={units.high}
            meters={meters.map((m) => {
              const d = data.get(m.id)!;
              const limit = limitOf(m.id);
              return {
                id: m.id,
                name: m.name,
                href: hrefFor(m.id),
                used: limit.known ? limit.used : null,
                projected: d.usage.state === "ok" ? d.usage.projected : null,
                state: limit.state,
                live: live ? live.meterId === m.id : null,
                reading: d.readingRows[0]?.value ?? null,
                check: checks.get(m.id)!,
                role: roomText(limit, units),
              };
            })}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <section aria-label="Used this cycle on both meters" className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
            <span className="font-mono text-[10.5px] tracking-[0.14em] text-label uppercase">Used this cycle · {meters.length === 2 ? "both meters" : "all meters"}</span>
            <p className="flex items-baseline gap-2.5">
              <span className="font-display text-5xl leading-none font-semibold tracking-tight md:text-6xl">{counting.length > 0 ? totalUsed : "–"}</span>
              <span className="text-sm text-muted-foreground">units since the bills</span>
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">Units only for now. Prices come once the tariff is added.</p>
          </section>

          {advice ? (
            <Note tone={limits.advice?.kind === "over" ? "over" : "near"} role={limits.advice?.kind === "over" ? "alert" : "status"}>
              {advice}
            </Note>
          ) : null}
          {nudge ? <Note tone="near">{nudge}</Note> : null}

          {unpaid.cents > 0 ? (
            <Link
              href="/bills#electricity"
              className="flex flex-col gap-1 rounded-2xl border border-primary/40 bg-accent p-4 outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-mono text-[10.5px] tracking-[0.14em] text-muted-foreground uppercase">To pay · in Bills</span>
              <span className="font-display text-3xl leading-none font-semibold tracking-tight">{formatMoney(unpaid.cents / 100)}</span>
              {unpaid.withoutAmount > 0 ? <span className="text-xs text-muted-foreground">plus {unpaid.withoutAmount} bill without an amount</span> : null}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="hidden md:block">
        <CycleChart
          low={units.low * 100}
          high={units.high * 100}
          cycleDays={cycleDays}
          lines={meters.map((m) => {
            const d = data.get(m.id)!;
            return {
              id: m.id,
              name: m.name,
              letter: badgeLetter(m.name),
              stroke: toneFor(toneIndexOf(m.id)).stroke,
              points: d.cycle,
              readings: d.readingRows,
              projected: d.usage.state === "ok" ? d.usage.projected : null,
            };
          })}
        />
      </div>

      <MonthlyChart meters={allMeters} bills={bills} />
    </div>
  );
}
