import { Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/shared/submit-button";
import { ServiceForm } from "@/components/vehicles/service-form";
import { Badge } from "@/components/ui/badge";
import { appConfig } from "@/config/app.config";
import type { VehicleService } from "@/db/schema";
import { describeDays } from "@/features/reminders/engine";
import { latestPerType } from "@/features/vehicles/service-logic";
import { createService, deleteService, updateService } from "@/features/vehicles/service-actions";
import { listServices } from "@/features/vehicles/queries";
import { daysBetween } from "@/lib/dates";
import { formatDate, formatMoney, todayInAppTz } from "@/lib/format";

/** The Services tab of a vehicle: add a record, yearly totals, and the history newest first. */
export async function ServicesTab({ vehicleId }: { vehicleId: string }) {
  const list = await listServices(vehicleId);
  const today = todayInAppTz(); // after the query, which opts this render into request time
  // The newest record of each type is the one whose next due date drives Reminders.
  const current = new Set(latestPerType(list).map((s) => s.id));
  const { serviceTypes } = appConfig.vehicles;

  return (
    <section aria-label="Services" className="flex flex-col gap-4">
      <details className="rounded-lg border">
        <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">Add a service</summary>
        <div className="border-t p-4">
          <ServiceForm action={createService} serviceTypes={serviceTypes} vehicleId={vehicleId} defaultDate={today} />
        </div>
      </details>

      {list.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No services recorded yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((s) => (
            <ServiceItem key={s.id} service={s} today={today} drivesReminder={current.has(s.id)} serviceTypes={serviceTypes} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ServiceItem({
  service: s,
  today,
  drivesReminder,
  serviceTypes,
}: {
  service: VehicleService;
  today: string;
  drivesReminder: boolean;
  serviceTypes: readonly string[];
}) {
  const days = s.nextDueDate ? daysBetween(today, s.nextDueDate) : null;
  return (
    <li className="rounded-lg border bg-card p-3 text-card-foreground">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{formatDate(s.serviceDate)}</p>
            <Badge variant="outline">{s.serviceType}</Badge>
            {s.cost !== null ? <span className="text-sm">{formatMoney(Number(s.cost))}</span> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[s.garage, s.odometerKm !== null ? `${s.odometerKm.toLocaleString("en-LK")} km` : null].filter(Boolean).join(" · ")}
          </p>
          {s.itemsDone ? <p className="mt-2 whitespace-pre-wrap text-sm">{s.itemsDone}</p> : null}
          {s.nextDueDate ? (
            <p className="mt-2 text-sm">
              Next due {formatDate(s.nextDueDate)}
              {drivesReminder && days !== null ? (
                <span className={days < 0 ? " font-medium text-status-overdue" : days <= 7 ? " text-status-soon" : " text-muted-foreground"}>
                  {" "}
                  · {describeDays(days)}
                </span>
              ) : (
                <span className="text-muted-foreground"> · replaced by a newer {s.serviceType.toLowerCase()} record</span>
              )}
            </p>
          ) : null}
        </div>
        <form action={deleteService}>
          <input type="hidden" name="id" value={s.id} />
          <SubmitButton variant="ghost" size="icon" aria-label={`Delete service from ${formatDate(s.serviceDate)}`} confirm="Delete this service record? This cannot be undone.">
            <Trash2 aria-hidden />
          </SubmitButton>
        </form>
      </div>
      <details className="mt-2 rounded-md border">
        <summary className="cursor-pointer px-3 py-1.5 text-sm text-muted-foreground">Edit</summary>
        <div className="border-t p-3">
          <ServiceForm action={updateService} serviceTypes={serviceTypes} service={s} />
        </div>
      </details>
    </li>
  );
}
