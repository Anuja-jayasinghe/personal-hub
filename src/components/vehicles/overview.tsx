import Link from "next/link";
import { NotesPanel } from "@/components/shared/notes-panel";
import { GlanceCards } from "@/components/vehicles/glance-cards";
import { AllClearBar, NeedsYouBar } from "@/components/vehicles/needs-you-bar";
import { OdometerSection } from "@/components/vehicles/odometer-section";
import { OverviewTimeline, type TimelineRow } from "@/components/vehicles/overview-timeline";
import { SourceMarker } from "@/components/vehicles/odometer-timeline";
import { appConfig } from "@/config/app.config";
import type { Vehicle } from "@/db/schema";
import type { HubRules } from "@/features/settings/rules";
import { buildTimeline, glanceCards, isBlank, itemHref, needsYou, oilState } from "@/features/vehicles/overview";
import { loadOverviewData } from "@/features/vehicles/overview-data";
import { vehiclePath } from "@/features/vehicles/plate";
import { findVehicleType } from "@/features/vehicles/vehicle-type";
import { formatDate, formatMoney, todayInAppTz } from "@/lib/format";

/**
 * The new Overview of a vehicle (V.2, C149; owner-approved design): the Needs you bar, the at-a-glance cards
 * soonest first, the latest services and the odometer on the left with the timeline on the right (below them on
 * a phone), then the notes and the vehicle's details tucked into one quiet row. Everything is worked out here on
 * the server from the vehicle's own rows; the browser gets plain values. Use inside <Suspense>.
 */

const SERVICES_SHOWN = 3;
const label = "font-mono text-[10.5px] font-normal tracking-[0.14em] text-label uppercase md:text-[11px]";

function Detail({ term, value }: { term: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="text-sm">{value ?? "—"}</dd>
    </div>
  );
}

export async function VehicleOverview({ vehicle, rules }: { vehicle: Vehicle; rules: HubRules }) {
  const data = await loadOverviewData(vehicle.id, vehicle.ignoreEmissionOdometer);
  const today = todayInAppTz(); // after the queries, which opt this render into request time
  const basePath = vehiclePath(vehicle);
  const { renewals, services, readings, fitting } = data;

  const blank = isBlank({ renewals, services, readings });
  const oil = oilState(services, rules, today, fitting);
  const attention = needsYou({
    today,
    renewals,
    services,
    rules,
    renewalLeadDays: new Map(appConfig.vehicles.renewalTypes.map((t) => [t.label, t.leadDays])),
    oil,
  });
  const cards = glanceCards({ today, renewals, oil, hasAnyRecord: !blank });
  const rows: TimelineRow[] = buildTimeline({ today, timeZone: appConfig.timeZone, renewals, services, readings }).map((e) => ({
    key: e.key,
    marker: e.marker,
    title: e.title,
    detail: e.detail,
    dateLabel: e.dateLabel,
    href: e.item ? itemHref(basePath, e.item) : null,
  }));
  const type = findVehicleType(appConfig.vehicles.types, vehicle.vehicleType);

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {blank ? (
        <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Nothing recorded yet.</span> A paper, a service or an odometer reading added from the hub makes the cards and the timeline here.
        </p>
      ) : (
        <>
          {attention.needs.length > 0 ? <NeedsYouBar needs={attention.needs} basePath={basePath} /> : <AllClearBar next={attention.next} />}
          <GlanceCards cards={cards} basePath={basePath} />
        </>
      )}

      <div className="grid items-start gap-4 md:gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4 md:gap-5">
          {services.length > 0 ? (
            <section aria-label="Services" className="flex flex-col gap-1 rounded-[18px] border bg-card p-4 md:rounded-[20px] md:p-5">
              <div className="flex items-baseline justify-between pb-2">
                <h2 className={label}>Services</h2>
                {/* The Services tab goes in V.3; until then it is where the whole list is. */}
                {services.length > SERVICES_SHOWN ? (
                  <Link href={vehiclePath(vehicle, "?tab=services")} className="text-[13px] font-semibold text-primary hover:underline">
                    Show all {services.length}
                  </Link>
                ) : null}
              </div>
              <ul className="flex flex-col">
                {services.slice(0, SERVICES_SHOWN).map((s) => (
                  <li key={s.id} className="border-b border-border/60 last:border-b-0">
                    <Link
                      href={itemHref(basePath, { kind: "service", id: s.id })}
                      scroll={false}
                      className="flex min-h-11 items-center gap-3 rounded-md px-1.5 py-2.5 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring md:gap-3.5"
                    >
                      <SourceMarker source="service" />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-sm font-semibold md:text-[14.5px]">{s.serviceType}</span>
                        <span className="text-xs text-muted-foreground md:text-[12.5px]">
                          {[formatDate(s.serviceDate), s.odometerKm !== null ? `${s.odometerKm.toLocaleString("en-LK")} km` : null, s.garage?.trim() || null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {s.cost !== null ? <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatMoney(Number(s.cost))}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <OdometerSection vehicleId={vehicle.id} vehicleName={vehicle.nickname} ignoreEmissionOdometer={vehicle.ignoreEmissionOdometer} />
        </div>

        {rows.length > 0 ? <OverviewTimeline rows={rows} /> : null}
      </div>

      <NotesPanel scope={{ kind: "owner", owner: { ownerType: "vehicle", ownerId: vehicle.id } }} title="Notes" hideWhenEmpty />

      <details className="group rounded-2xl border">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-2xl px-4 text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring md:px-[18px] [&::-webkit-details-marker]:hidden">
          <span className={label}>Vehicle details</span>
          <span className="flex-1" />
          <span aria-hidden className="transition-transform group-open:rotate-90">
            ▸
          </span>
        </summary>
        <dl className="grid gap-4 border-t px-4 py-4 sm:grid-cols-3 md:px-[18px]">
          <Detail term="Type" value={type?.label} />
          <Detail term="Make" value={vehicle.make} />
          <Detail term="Model" value={vehicle.model} />
          <Detail term="Year" value={vehicle.year} />
          <Detail term="Fuel" value={vehicle.fuelType} />
          <Detail term="Registration" value={vehicle.registrationNumber} />
        </dl>
      </details>
    </div>
  );
}
