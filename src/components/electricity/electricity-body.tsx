import Link from "next/link";
import { ElectricityOverview } from "@/components/electricity/electricity-overview";
import { ElectricityTabs } from "@/components/electricity/electricity-tabs";
import { MeterForm } from "@/components/electricity/meter-form";
import { AddBothReadingsButton } from "@/components/electricity/popover-button";
import { MeterView } from "@/components/electricity/meter-view";
import { EmptyState } from "@/components/shell/page-header";
import { appConfig } from "@/config/app.config";
import type { ElectricityBill, ElectricityMeter, ElectricityReading } from "@/db/schema";
import { createMeter } from "@/features/electricity/actions";
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
        cycleDays: appConfig.electricity.billingCycleDays,
      }),
    ]),
  );

  const picked = meters.find((m) => m.id === meterParam) ?? null;
  const selected = picked ?? (showArchived ? (meters[0] ?? null) : null);
  const meterHref = (id: string) => `${basePath}${showArchived ? "?archived=1&" : "?"}meter=${id}`;

  return (
    <>
      {meters.length === 0 ? (
        <EmptyState
          title={showArchived ? "No archived meters" : "No meters yet"}
          hint={showArchived ? "Meters you archive show up here with their history." : "Add your electricity meter(s) under Manage meters below, then log readings and bills."}
        />
      ) : (
        <>
          {meters.length > 1 || selected ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ElectricityTabs
                meters={meters}
                toneIndexOf={toneIndexOf}
                selectedId={selected?.id ?? null}
                showBoth={!showArchived && meters.length > 1}
                archived={showArchived}
                basePath={basePath}
              />
              {!showArchived && meters.length > 1 ? (
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
              meter={selected}
              toneIndex={toneIndexOf(selected.id)}
              allMeters={allMeters}
              data={data.get(selected.id)!}
              readings={readings.filter((r) => r.meterId === selected.id)}
              today={today}
            />
          ) : (
            <ElectricityOverview meters={meters} allMeters={allMeters} bills={bills} data={data} toneIndexOf={toneIndexOf} hrefFor={meterHref} />
          )}
        </>
      )}

      {showArchived ? (
        <Link href={basePath} className="text-sm underline-offset-2 hover:underline">
          ← Back to active meters
        </Link>
      ) : (
        <details className="@container rounded-lg border text-sm" open={meters.length === 0}>
          <summary className="cursor-pointer px-4 py-2.5 text-muted-foreground">Manage meters</summary>
          <div className="flex flex-col gap-4 border-t p-4">
            <div>
              <h2 className="mb-2 font-medium">Add a meter</h2>
              <MeterForm action={createMeter} />
            </div>
            {archivedCount > 0 ? (
              <Link href={`${basePath}?archived=1`} className="underline-offset-2 hover:underline">
                Show archived meters ({archivedCount})
              </Link>
            ) : null}
          </div>
        </details>
      )}
    </>
  );
}
