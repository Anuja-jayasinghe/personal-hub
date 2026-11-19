import Link from "next/link";
import { CycleChart } from "@/components/electricity/cycle-chart";
import { LiveControls } from "@/components/electricity/live-switch";
import { MeterBoard } from "@/components/electricity/meter-board";
import { MeterBadge, toneFor } from "@/components/electricity/meter-tone";
import { MonthlyChart } from "@/components/electricity/monthly-chart";
import { SlabRule } from "@/components/electricity/slab-rule";
import { appConfig } from "@/config/app.config";
import type { ElectricityBill, ElectricityMeter } from "@/db/schema";
import type { MeterData } from "@/features/electricity/meter-data";
import { checkNudge, type LastChecked } from "@/features/electricity/last-checked";
import type { LimitsResult } from "@/features/electricity/limits";
import type { LiveMeter } from "@/features/electricity/live";
import { adviceLine, paceLine, usedOfLimit, type LimitUnits } from "@/features/electricity/limits-text";
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
 * The "Both" view (C78, C87; restyled in R.3a, boards HElectricity and HElectricityDesktop): the meter
 * board, a slab rule per meter, any warning, the room left before a price jump with the pace, what is
 * still to pay, the cycle chart on wide screens, and the monthly chart.
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
  today,
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
  today: string;
}) {
  const unpaid = unpaidTotal(bills.filter((b) => meters.some((m) => m.id === b.meterId)));
  const pace = paceLine(limits);
  const advice = adviceLine(limits.advice, limits, nameOf, units, live?.meterId ?? null);
  const nudge = checkNudge(meters.map((m) => ({ name: m.name, check: checks.get(m.id)! })));
  const room = Math.floor(limits.headroom / 100);
  const low = units.low * 100;
  const high = units.high * 100;
  const limitOf = (id: string) => limits.meters.find((l) => l.id === id)!;

  return (
    <div className="flex flex-col gap-3 md:gap-5">
      <MeterBoard
        units={units}
        meters={meters.map((m) => {
          const d = data.get(m.id)!;
          return {
            id: m.id,
            name: m.name,
            href: hrefFor(m.id),
            limit: limitOf(m.id),
            check: checks.get(m.id)!,
            reading: d.readingRows[0]?.value ?? null,
            flowing: live ? live.meterId === m.id : d.usage.state === "ok" && (d.usage.dailyAverage ?? 0) > 0,
            live: live ? live.meterId === m.id : null,
          };
        })}
      />

      {meters.length > 1 ? <LiveControls meters={meters.map((m) => ({ id: m.id, name: m.name }))} live={live} today={today} /> : null}

      {advice ? (
        <Note tone={limits.advice?.kind === "over" ? "over" : "near"} role={limits.advice?.kind === "over" ? "alert" : "status"}>
          {advice}
        </Note>
      ) : null}
      {nudge ? <Note tone="near">{nudge}</Note> : null}

      <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:gap-5">
        <div className="flex flex-col gap-3">
          {meters.map((m) => {
            const d = data.get(m.id)!;
            const limit = limitOf(m.id);
            return (
              <Link
                key={m.id}
                href={hrefFor(m.id)}
                aria-label={`${m.name}: ${usedOfLimit(limit)}`}
                className="flex flex-col gap-1 rounded-2xl border bg-card px-4 pt-3 pb-1.5 outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-baseline gap-2">
                  <MeterBadge name={m.name} className="self-center" />
                  <span className="text-sm font-semibold">{m.name}</span>
                  <span className="text-xs text-muted-foreground">{limit.known ? `${Math.round(limit.used / 100)} used` : "not counting yet"}</span>
                  {d.usage.state === "ok" && d.usage.projected !== null ? (
                    <span className="ml-auto font-mono text-[10.5px] text-label">PACE ~{Math.round(d.usage.projected / 100)}</span>
                  ) : null}
                </span>
                <SlabRule used={limit.used} projected={d.usage.state === "ok" ? d.usage.projected : null} low={low} high={high} state={limit.state} size="sm" />
              </Link>
            );
          })}
        </div>

        <div className="flex flex-col gap-3">
          <section aria-label="Room before a price jump" className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
            <span className="font-mono text-[10.5px] tracking-[0.14em] text-label uppercase">Both meters</span>
            <p className="flex items-baseline gap-2.5">
              <span className="font-display text-5xl leading-none font-semibold tracking-tight md:text-6xl">{room}</span>
              <span className="text-sm text-muted-foreground">units before a price jump</span>
            </p>
            {pace ? (
              <p className={`flex gap-2 text-sm leading-relaxed ${pace.tone === "warn" ? "text-status-soon" : "text-muted-foreground"}`}>
                <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${pace.tone === "warn" ? "bg-status-soon-mark" : "bg-status-ok"}`} />
                {pace.text}
              </p>
            ) : null}
          </section>

          {unpaid.cents > 0 ? (
            <section aria-label="To pay" className="flex flex-col gap-1 rounded-2xl border border-primary/40 bg-accent p-4">
              <span className="font-mono text-[10.5px] tracking-[0.14em] text-muted-foreground uppercase">To pay</span>
              <span className="font-display text-3xl leading-none font-semibold tracking-tight">{formatMoney(unpaid.cents / 100)}</span>
              {unpaid.withoutAmount > 0 ? (
                <span className="text-xs text-muted-foreground">plus {unpaid.withoutAmount} bill without an amount</span>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>

      <div className="hidden md:block">
        <CycleChart
          low={low}
          high={high}
          cycleDays={appConfig.electricity.billingCycleDays}
          lines={meters.map((m) => {
            const d = data.get(m.id)!;
            return {
              id: m.id,
              name: m.name,
              letter: badgeLetter(m.name),
              stroke: toneFor(toneIndexOf(m.id)).stroke,
              points: d.cycle,
              projected: d.usage.state === "ok" ? d.usage.projected : null,
            };
          })}
        />
      </div>

      <MonthlyChart meters={allMeters} bills={bills} />
    </div>
  );
}
