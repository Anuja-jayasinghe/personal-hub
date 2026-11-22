import Link from "next/link";
import { ElectricityOverview } from "@/components/electricity/electricity-overview";
import { ElectricityTabs } from "@/components/electricity/electricity-tabs";
import { SwitchLiveButton } from "@/components/electricity/live-switch";
import { AddBothReadingsButton } from "@/components/electricity/popover-button";
import { MeterView } from "@/components/electricity/meter-view";
import { EmptyState } from "@/components/shell/page-header";
import type { ElectricityBill, ElectricityMeter, ElectricityReading } from "@/db/schema";
import { lastChecked } from "@/features/electricity/last-checked";
import { computeLimits } from "@/features/electricity/limits";
import { limitInputFromUsage, limitRulesFromConfig } from "@/features/electricity/limits-input";
import type { LiveMeter } from "@/features/electricity/live";
import { unitsOf, type HubRules } from "@/features/settings/rules";
import { describeMeter } from "@/features/electricity/meter-data";

/**
 * Everything on the Electricity page below the title (C78), given the rows already loaded: the
 * switcher (Both, one tab per meter), then either the combined overview or one meter's view, and the
 * collapsed "Manage meters" section. `meters` are the active ones, or the archived ones when
 * `showArchived` is set; `allMeters` is every meter, active first, which fixes each meter's colour;
 * `meterParam` is the `?meter=` value.
 */
export function ElectricityBody({
  meters,
  allMeters,
  archivedCount,
  readings,
  bills,
  live = null,
  rules,
  can = { addReadings: true, editReadings: true, seeBills: true },
  today,
  showArchived,
  meterParam,
  basePath = "/electricity",
}: {
  meters: ElectricityMeter[];
  allMeters: ElectricityMeter[];
  archivedCount: number;
  readings: ElectricityReading[];
  bills: ElectricityBill[];
  /** The meter carrying the house (issue #69), among the active meters; null when not set. */
  live?: LiveMeter | null;
  /** What this person may do here (S.8, C114); owners can do all of it. `switchLive`: owners only (C131). */
  can?: { addReadings: boolean; editReadings: boolean; seeBills: boolean; switchLive?: boolean };
  /** The rules in force (Settings, C107). */
  rules: HubRules;
  today: string;
  showArchived: boolean;
  meterParam: string | undefined;
  basePath?: string;
}) {
  // A meter keeps its badge colour: its position among all meters, active first, then archived.
  const toneIndexOf = (id: string) => Math.max(0, allMeters.findIndex((m) => m.id === id));
  const data = new Map(
    meters.map((m) => [
      m.id,
      describeMeter({
        bills: bills.filter((b) => b.meterId === m.id),
        readings: readings.filter((r) => r.meterId === m.id),
        today,
        cycleDays: rules.billingCycleDays,
      }),
    ]),
  );

  // The 120 / 180 rule (C82): worked out across the active meters; an archived meter is looked at on its own.
  const limitRules = limitRulesFromConfig(rules);
  const units = unitsOf(rules);
  const inputs = meters.map((m) => limitInputFromUsage(m.id, data.get(m.id)!.usage));
  const limits = computeLimits(inputs, limitRules);
  const limitFor = (id: string) =>
    showArchived ? computeLimits(inputs.filter((i) => i.id === id), limitRules).meters[0] : limits.meters.find((l) => l.id === id)!;
  const nameOf = (id: string) => meters.find((m) => m.id === id)?.name ?? "Meter";

  // The owner's quiet switch on each idle meter's instrument (C131): the same dialog as Settings › Meters.
  const liveMeter = live ? meters.find((m) => m.id === live.meterId) : undefined;
  const liveControlFor = (id: string) => {
    const target = meters.find((m) => m.id === id);
    if (!can.switchLive || showArchived || meters.length < 2 || !target || live?.meterId === id) return undefined;
    return (
      <SwitchLiveButton
        quiet
        target={{ id: target.id, name: target.name }}
        current={liveMeter ? { id: liveMeter.id, name: liveMeter.name } : null}
        since={live?.since ?? null}
        today={today}
      />
    );
  };

  // When each meter was last read by a person (2b.4).
  const checks = new Map(meters.map((m) => [m.id, lastChecked(data.get(m.id)!.readingRows[0]?.date ?? null, today, rules.checkEveryDays)]));

  const picked = meters.find((m) => m.id === meterParam) ?? null;
  const selected = picked ?? (showArchived ? (meters[0] ?? null) : null);
  const meterHref = (id: string) => `${basePath}${showArchived ? "?archived=1&" : "?"}meter=${id}`;

  return (
    <>
      {meters.length === 0 ? (
        <EmptyState
          title={showArchived ? "No archived meters" : "No meters yet"}
          hint={showArchived ? "Meters you archive show up here with their history." : "Add your meters in Settings › Meters and rules, the last bill in Bills, then read the meters here."}
        />
      ) : (
        <>
          {meters.length > 1 || selected ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ElectricityTabs
                meters={meters}
                selectedId={selected?.id ?? null}
                showBoth={!showArchived && meters.length > 1}
                archived={showArchived}
                basePath={basePath}
              />
              {!showArchived && meters.length > 1 && can.addReadings ? (
                <AddBothReadingsButton
                  defaultDate={today}
                  meters={meters.map((m) => {
                    const newest = data.get(m.id)?.readingRows[0];
                    return { id: m.id, name: m.name, toneIndex: toneIndexOf(m.id), lastValue: newest?.value ?? null, lastDate: newest?.date ?? null };
                  })}
                />
              ) : null}
            </div>
          ) : null}

          {selected ? (
            <MeterView
              can={can}
              meter={selected}
              allMeters={allMeters}
              data={data.get(selected.id)!}
              readings={readings.filter((r) => r.meterId === selected.id)}
              today={today}
              limit={limitFor(selected.id)}
              units={units}
              check={checks.get(selected.id)!}
              live={live && !showArchived ? live.meterId === selected.id : null}
              liveControl={liveControlFor(selected.id)}
            />
          ) : (
            <ElectricityOverview meters={meters} allMeters={allMeters} bills={bills} data={data} toneIndexOf={toneIndexOf} hrefFor={meterHref} limits={limits} units={units} nameOf={nameOf} checks={checks} live={live} liveControlFor={liveControlFor} cycleDays={rules.billingCycleDays} seeBills={can.seeBills} />
          )}
        </>
      )}

      {showArchived ? (
        <Link href={basePath} className="text-sm underline-offset-2 hover:underline">
          ← Back to active meters
        </Link>
      ) : archivedCount > 0 ? (
          <Link href={`${basePath}?archived=1`} className="self-start text-sm text-muted-foreground underline-offset-2 hover:underline">
            Archived meters ({archivedCount})
          </Link>
      ) : null}
    </>
  );
}
