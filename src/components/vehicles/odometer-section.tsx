import { Trash2 } from "lucide-react";
import Link from "next/link";
import { OdometerForm } from "@/components/vehicles/odometer-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { Badge } from "@/components/ui/badge";
import { deleteOdometerReading, addOdometerReading, updateOdometerReading } from "@/features/vehicles/odometer-actions";
import { latestPoint, toPoints, withDistances } from "@/features/vehicles/odometer";
import { listOdometerReadings, listServices } from "@/features/vehicles/queries";
import { formatDate, todayInAppTz } from "@/lib/format";

const km = (n: number) => `${n.toLocaleString("en-LK")} km`;

/**
 * A vehicle's odometer as dated readings: the latest value with the day it was read, a form to add
 * a reading, and the history with the distance between values. A service with an odometer counts as
 * a reading (edit it on the Services tab).
 */
export async function OdometerSection({ vehicleId }: { vehicleId: string }) {
  const [readings, services] = await Promise.all([listOdometerReadings(vehicleId), listServices(vehicleId)]);
  const today = todayInAppTz(); // after the queries, which opt this render into request time
  const points = toPoints(readings, services);
  const latest = latestPoint(points);
  const history = withDistances(points).reverse(); // newest first
  const rowOf = new Map(readings.map((r) => [r.id, r]));

  return (
    <section aria-labelledby="odometer" className="flex flex-col gap-3">
      <h2 id="odometer" className="text-lg font-medium">
        Odometer
      </h2>
      {latest ? (
        <p className="text-sm">
          <span className="text-2xl font-semibold">{km(latest.km)}</span>{" "}
          <span className="text-muted-foreground">as of {formatDate(latest.date)}</span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">No readings yet. Add one with the date you read it, so an old value is never mistaken for today&apos;s.</p>
      )}

      <details className="rounded-lg border border-primary/40">
        <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">Add a reading</summary>
        <div className="border-t p-4">
          <OdometerForm action={addOdometerReading} vehicleId={vehicleId} defaultDate={today} />
        </div>
      </details>

      {history.length > 0 ? (
        <details className="rounded-lg border" open={history.length <= 6}>
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">History ({history.length})</summary>
          <ul className="flex flex-col divide-y border-t">
            {history.map((p) => {
              const row = p.source === "reading" ? rowOf.get(p.id) : undefined;
              return (
                <li key={`${p.source}:${p.id}`} className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-medium">{formatDate(p.date)}</span>
                    <span>{km(p.km)}</span>
                    {p.sinceKm !== null && p.sinceDays !== null ? (
                      <span className="text-muted-foreground">
                        +{km(p.sinceKm)} in {p.sinceDays} day{p.sinceDays === 1 ? "" : "s"}
                      </span>
                    ) : null}
                    {p.source === "service" ? (
                      <Link href={`/vehicles/${vehicleId}?tab=services`} className="underline-offset-2 hover:underline">
                        <Badge variant="outline">Service · {p.label}</Badge>
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
                      <summary className="cursor-pointer px-3 py-1 text-xs text-muted-foreground">Edit</summary>
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
