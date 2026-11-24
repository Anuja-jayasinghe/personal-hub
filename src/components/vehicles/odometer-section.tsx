import { Trash2 } from "lucide-react";
import Link from "next/link";
import { OdometerForm } from "@/components/vehicles/odometer-form";
import { AddOdometerSheet } from "@/components/vehicles/vehicle-sheets";
import { SubmitButton } from "@/components/shared/submit-button";
import { deleteOdometerReading, updateOdometerReading } from "@/features/vehicles/odometer-actions";
import { OdometerTimeline, SOURCE_NAMES, SourceMarker } from "@/components/vehicles/odometer-timeline";
import { latestPoint, pointKey, toPoints, unfitKeys, withDistances } from "@/features/vehicles/odometer";
import type { VehicleOdometerReading, VehicleRenewal, VehicleService } from "@/db/schema";
import { carriesOdometer } from "@/features/vehicles/renewal-validate";
import { formatDate, todayInAppTz } from "@/lib/format";

const km = (n: number) => `${n.toLocaleString("en-LK")} km`;

/**
 * A vehicle's odometer as dated values from three sources (issue #181): readings typed here, services
 * with an odometer and emission tests with the test-day odometer (edit those on their own tab). It shows
 * the latest value, the timeline (marker shape = source) and the history with the distance between
 * values. A service or test value that doesn't fit is kept, flagged, and left out of the latest value
 * and the distances.
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
    <section aria-labelledby="odometer" className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-3">
        <h2 id="odometer" className="font-mono text-[10.5px] font-normal tracking-[0.14em] text-label uppercase">
          Odometer
        </h2>
        {canAdd ? (
          <span className="ml-auto">
            <AddOdometerSheet vehicleId={vehicleId} vehicleName={vehicleName} defaultDate={today} />
          </span>
        ) : null}
      </div>
      {latest ? (
        <p className="flex flex-wrap items-center gap-3">
          <span role="img" aria-label={`${km(latest.km)}`} className="flex gap-0.5">
            {String(latest.km)
              .padStart(6, "0")
              .split("")
              .map((d, i) => (
                <span key={i} className="flex h-8 w-6 items-center justify-center rounded-[5px] bg-raised font-mono text-base font-semibold">
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
          No readings yet.{canAdd ? " Add one with the date you read it, so an old value is never mistaken for today\u2019s." : ""}
        </p>
      )}

      <OdometerTimeline points={points} unfit={unfit} />

      {history.length > 0 ? (
        <details className="rounded-lg border" open={history.length <= 6}>
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">History ({history.length})</summary>
          <ul className="flex flex-col divide-y border-t">
            {history.map((p) => {
              const row = p.source === "reading" && canEdit ? rowOf.get(p.id) : undefined;
              const bad = unfit.has(pointKey(p));
              const since = distance.get(pointKey(p));
              return (
                <li key={pointKey(p)} className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <SourceMarker source={p.source} unfit={bad} />
                    <span className="sr-only">{SOURCE_NAMES[p.source]}</span>
                    <span className="font-medium">{formatDate(p.date)}</span>
                    <span className={bad ? "text-status-overdue line-through decoration-1" : undefined}>{km(p.km)}</span>
                    {bad ? (
                      <span className="font-mono text-[10.5px] tracking-wide text-status-overdue uppercase">Doesn&apos;t fit</span>
                    ) : since && since.sinceKm !== null && since.sinceDays !== null ? (
                      <span className="text-muted-foreground">
                        +{km(since.sinceKm)} in {since.sinceDays} day{since.sinceDays === 1 ? "" : "s"}
                      </span>
                    ) : null}
                    {p.source === "service" || p.source === "emission" ? (
                      <Link href={`/vehicles/${vehicleId}?item=${p.source === "service" ? "service" : "renewal"}:${p.id}`} scroll={false} className="-my-1 inline-flex min-h-11 items-center text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                        {p.label ?? SOURCE_NAMES[p.source]}
                      </Link>
                    ) : p.label ? (
                      <span className="text-muted-foreground">{p.label}</span>
                    ) : null}
                    {row ? (
                      <form action={deleteOdometerReading} className="ml-auto">
                        <input type="hidden" name="id" value={row.id} />
                        <SubmitButton variant="ghost" size="icon-sm" aria-label={`Delete the reading from ${formatDate(p.date)}`} confirm="Delete this odometer reading?">
                          <Trash2 aria-hidden />
                        </SubmitButton>
                      </form>
                    ) : null}
                  </div>
                  {row ? (
                    <details className="mt-2 rounded-md border">
                      <summary className="flex min-h-11 cursor-pointer items-center px-3 text-xs text-muted-foreground">Edit</summary>
                      <div className="border-t p-3">
                        <OdometerForm action={updateOdometerReading} reading={row} />
                      </div>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
