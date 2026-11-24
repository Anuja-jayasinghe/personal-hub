import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { OdometerReadingRow } from "@/components/vehicles/odometer-reading-row";
import { AddOdometerSheet } from "@/components/vehicles/vehicle-sheets";
import { OdometerTimeline, SOURCE_NAMES, SourceMarker } from "@/components/vehicles/odometer-timeline";
import { latestPoint, pointKey, toPoints, unfitKeys, withDistances } from "@/features/vehicles/odometer";
import type { VehicleOdometerReading, VehicleRenewal, VehicleService } from "@/db/schema";
import { carriesOdometer } from "@/features/vehicles/renewal-validate";
import { formatDate, todayInAppTz } from "@/lib/format";

const km = (n: number) => `${n.toLocaleString("en-LK")} km`;

/**
 * A vehicle's odometer as dated values from three sources (issue #181): readings typed here, services
 * with an odometer and emission tests with the test-day odometer (edit those in their own sheet). It shows
 * the latest value, the timeline (marker shape = source) and the history with the distance between
 * values. A service or test value that doesn't fit is kept, flagged, and left out of the latest value
 * and the distances. Issue #237: the history rows are tidy lines (date and source on the left, the km on the
 * right) and a typed reading's Edit and Delete are quiet icon buttons inside its row (`OdometerReadingRow`).
 */
export function OdometerSection({
  vehicleId,
  vehicleName,
  ignoreEmissionOdometer = false,
  readings,
  services,
  renewals,
  canAdd,
  canEdit,
}: {
  vehicleId: string;
  vehicleName: string;
  ignoreEmissionOdometer?: boolean;
  /** What the Overview already loaded for this vehicle (V.4: no second round of queries). */
  readings: readonly VehicleOdometerReading[];
  services: readonly VehicleService[];
  renewals: readonly VehicleRenewal[];
  /** Add in Vehicles: the "Add km" button. A person who may only see has none. */
  canAdd: boolean;
  /** Edit in Vehicles: changing or deleting a typed reading. */
  canEdit: boolean;
}) {
  const today = todayInAppTz();
  // A vehicle whose emission certificates print an inaccurate odometer leaves them out (issue #184).
  const points = toPoints(readings, services, ignoreEmissionOdometer ? [] : renewals.filter((r) => carriesOdometer(r.type)));
  const unfit = unfitKeys(points);
  const fitting = points.filter((p) => !unfit.has(pointKey(p)));
  const latest = latestPoint(fitting);
  // Distances between the values that fit; a flagged value is listed without one.
  const distance = new Map(withDistances(fitting).map((p) => [pointKey(p), p]));
  const history = [...points].reverse(); // newest first
  const rowOf = new Map(readings.map((r) => [r.id, r]));

  return (
    <section aria-labelledby="odometer" className="flex flex-col gap-4 rounded-[18px] border bg-card p-4 md:rounded-[20px] md:p-5">
      <div className="flex items-center gap-3">
        <h2 id="odometer" className="font-mono text-[10.5px] font-normal tracking-[0.14em] text-label uppercase md:text-[11px]">
          Odometer
        </h2>
        {canAdd ? (
          <span className="ml-auto">
            <AddOdometerSheet vehicleId={vehicleId} vehicleName={vehicleName} defaultDate={today} />
          </span>
        ) : null}
      </div>
      {latest ? (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span role="img" aria-label={`${km(latest.km)}`} className="flex gap-1">
            {String(latest.km)
              .padStart(6, "0")
              .split("")
              .map((d, i, all) => (
                <span
                  key={i}
                  className={`flex h-10 w-7 items-center justify-center rounded-lg font-mono text-xl font-semibold md:h-11 md:w-8 ${i === all.length - 1 ? "bg-primary text-primary-foreground" : "bg-raised"}`}
                >
                  {d}
                </span>
              ))}
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-label uppercase">
            km · as of {formatDate(latest.date)} · <SourceMarker source={latest.source} />
            <span className="sr-only">{SOURCE_NAMES[latest.source]}</span>
          </span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          No readings yet.{canAdd ? " Add one with the date you read it, so an old value is never mistaken for today’s." : ""}
        </p>
      )}

      <OdometerTimeline points={points} unfit={unfit} />

      {history.length > 0 ? (
        <details className="group rounded-xl border" open={history.length <= 6}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-[inherit] px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring md:px-4 [&::-webkit-details-marker]:hidden">
            <ChevronRight aria-hidden className="size-4 text-label transition-transform group-open:rotate-90 motion-reduce:transition-none" />
            History ({history.length})
          </summary>
          <ul className="flex flex-col divide-y border-t">
            {history.map((p) => {
              const row = p.source === "reading" && canEdit ? rowOf.get(p.id) : undefined;
              const bad = unfit.has(pointKey(p));
              const since = distance.get(pointKey(p));
              return (
                <OdometerReadingRow key={pointKey(p)} reading={row} dateLabel={formatDate(p.date)} spare={canEdit}>
                  <div className="flex items-center gap-3">
                    <SourceMarker source={p.source} unfit={bad} />
                    <span className="sr-only">{SOURCE_NAMES[p.source]}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex flex-wrap items-baseline gap-x-2.5 text-sm">
                        <span className="font-medium whitespace-nowrap">{formatDate(p.date)}</span>
                        {p.source === "service" || p.source === "emission" ? (
                          <Link
                            href={`/vehicles/${vehicleId}?item=${p.source === "service" ? "service" : "renewal"}:${p.id}`}
                            scroll={false}
                            className="-my-2 inline-flex min-h-11 items-center rounded-sm text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {p.label ?? SOURCE_NAMES[p.source]}
                          </Link>
                        ) : p.label ? (
                          <span className="text-muted-foreground">{p.label}</span>
                        ) : null}
                      </span>
                      {bad ? (
                        <span className="font-mono text-[10.5px] tracking-wide text-status-overdue uppercase">Doesn&apos;t fit</span>
                      ) : since && since.sinceKm !== null && since.sinceDays !== null ? (
                        <span className="text-xs text-muted-foreground">
                          +{km(since.sinceKm)} in {since.sinceDays} day{since.sinceDays === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </span>
                    <span className={`shrink-0 font-mono text-[13px] font-semibold tabular-nums md:text-sm ${bad ? "text-status-overdue line-through decoration-1" : ""}`}>{km(p.km)}</span>
                  </div>
                </OdometerReadingRow>
              );
            })}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
