import { connection } from "next/server";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { AddBothReadingsButton } from "@/components/electricity/popover-button";
import { AreaTiles } from "@/components/home/area-tiles";
import { ElectricitySummary } from "@/components/home/electricity-summary";
import { NeedsYouNext, type NextItem } from "@/components/home/needs-you-next";
import { NextDaysLine } from "@/components/home/next-days-line";
import { SetupCard } from "@/components/home/setup-card";
import { Skeleton } from "@/components/ui/skeleton";
import { appConfig, isModuleEnabled } from "@/config/app.config";
import { listAllBills, listAllReadings, listLiveSwitches, listMeters } from "@/features/electricity/queries";
import { electricitySnapshot } from "@/features/electricity/snapshot";
import { dayStamp, dueByArea, greetingFor, meterCheckDue, nextDays, setupSteps } from "@/features/home/home";
import { getReminders } from "@/features/reminders/load";
import { getFirstName } from "@/lib/auth";
import { daysBetween } from "@/lib/dates";
import { hourInAppTz } from "@/lib/format";

/** How far ahead Home looks (the line and the tiles). */
const WINDOW_DAYS = 30;
/** How many rows "Needs you next" shows; the Reminders page has everything. */
const NEXT_SHOWN = 4;

/**
 * Home (R.4; boards HHomePhone, HHome, HStates): a greeting, the electricity card (or first-day setup),
 * Read the meters, the next 30 days as a line, what needs you next, and small tiles for the other areas.
 */
async function HomeContent() {
  await connection();
  const electricityOn = isModuleEnabled("electricity");
  const [meters, readings, bills, switches, reminders, firstName] = await Promise.all([
    electricityOn ? listMeters(false) : Promise.resolve([]),
    electricityOn ? listAllReadings() : Promise.resolve([]),
    electricityOn ? listAllBills() : Promise.resolve([]),
    electricityOn ? listLiveSwitches() : Promise.resolve([]),
    getReminders(),
    getFirstName(),
  ]);
  const { today, results } = reminders;
  const snap = electricitySnapshot({ meters, readings, bills, switches, today });
  const { checkEveryDays, billingCycleDays } = appConfig.electricity;

  // Day of the cycle, from the first meter with a bill.
  const sinceDate = meters.map((m) => snap.data.get(m.id)!.last?.readingDate).find(Boolean);
  const cycleDay = sinceDate ? daysBetween(sinceDate, today) : null;

  // First day: until every meter has a bill and a reading after it, Home shows the setup steps.
  const steps = setupSteps({
    meters: meters.length,
    bills: meters.filter((m) => snap.data.get(m.id)!.last).length === meters.length && meters.length > 0 ? 1 : 0,
    readingsSinceBill: meters.length > 0 && meters.every((m) => snap.data.get(m.id)!.usage.state === "ok") ? 1 : 0,
  });
  const settingUp = electricityOn && steps.some((s) => !s.done);

  const checks = meters.map((m) => ({ meterName: m.name, dueDate: meterCheckDue(snap.data.get(m.id)!.readingRows[0]?.date ?? null, checkEveryDays, today) }));
  const days = nextDays({ reminders: results, checks, today, days: WINDOW_DAYS });
  const kindOf = new Map(results.map((r) => [r.item.id, r.item.kind]));
  const next: NextItem[] = days
    .flatMap((d) => d.items.map((i) => ({ ...i, date: d.date, sub: i.tone === "check" || i.key.startsWith("check:") ? `every ${checkEveryDays} days` : (kindOf.get(i.key) ?? "") })))
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, NEXT_SHOWN);

  const entries = meters.map((m, i) => {
    const newest = snap.data.get(m.id)?.readingRows[0];
    return { id: m.id, name: m.name, toneIndex: i, lastValue: newest?.value ?? null, lastDate: newest?.date ?? null };
  });

  return (
    <>
      <header className="flex items-start gap-3">
        <span className="pt-1 md:hidden">
          <Logo size={30} decorative />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10.5px] tracking-[0.14em] text-label uppercase">
            {dayStamp(today)}
            {cycleDay !== null ? ` · day ${cycleDay} of ${billingCycleDays}` : ""}
          </p>
          <h1 className="mt-1 text-[26px] leading-tight font-normal tracking-tight md:text-[40px] md:font-light">
            {greetingFor(hourInAppTz())}
            {firstName ? `, ${firstName}` : ""}.
          </h1>
        </div>
        {meters.length > 0 && !settingUp ? (
          <span className="hidden md:block">
            <AddBothReadingsButton meters={entries} defaultDate={today} />
          </span>
        ) : null}
      </header>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:gap-5">
        <div className="flex flex-col gap-3 md:gap-5">
          {settingUp ? <SetupCard steps={steps} /> : meters.length > 0 ? <ElectricitySummary snapshot={snap} /> : null}
          {meters.length > 0 && !settingUp ? (
            <div className="md:hidden [&_button]:w-full">
              <AddBothReadingsButton meters={entries} defaultDate={today} />
            </div>
          ) : null}
          <NextDaysLine days={days} windowDays={WINDOW_DAYS} />
        </div>
        <NeedsYouNext items={next} />
      </div>

      <AreaTiles counts={dueByArea(results, WINDOW_DAYS)} windowDays={WINDOW_DAYS} />

      {reminders.failedSources.length > 0 ? (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t load reminders from: {reminders.failedSources.join(", ")}.
        </p>
      ) : null}
    </>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-3" aria-label="Loading Home">
          <Skeleton className="h-16 w-2/3 rounded-xl" />
          <Skeleton className="h-64 w-full rounded-3xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
