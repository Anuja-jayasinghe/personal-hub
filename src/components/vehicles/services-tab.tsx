import { Trash2 } from "lucide-react";
import { AttachmentsPanel } from "@/components/shared/attachments-panel";
import { SubmitButton } from "@/components/shared/submit-button";
import { ServiceForm } from "@/components/vehicles/service-form";
import { AddInvoiceSheet, AddServiceSheet } from "@/components/vehicles/vehicle-sheets";
import { Badge } from "@/components/ui/badge";
import { appConfig } from "@/config/app.config";
import type { Attachment, VehicleService } from "@/db/schema";
import { describeDays } from "@/features/reminders/engine";
import { getRules } from "@/features/settings/queries";
import { attachmentsByOwner } from "@/features/shared/queries";
import { docFileName, SERVICE_FILE_KIND } from "@/features/vehicles/doc-names";
import { latestPerType } from "@/features/vehicles/service-logic";
import { deleteService, updateService } from "@/features/vehicles/service-actions";
import { listServices } from "@/features/vehicles/queries";
import { isDemo } from "@/lib/auth";
import { daysBetween } from "@/lib/dates";
import { formatDate, formatMoney, todayInAppTz } from "@/lib/format";

/** What this person may do with a service's invoices: they are Vehicle documents (C114, V.1a). */
export type ServiceFilesAccess = { canSee: boolean; canAdd: boolean };

/** The Services tab of a vehicle: add a record, yearly totals, and the history newest first. */
export async function ServicesTab({ vehicleId, vehicleName, namePrefix, docs }: { vehicleId: string; vehicleName: string; namePrefix: string; docs: ServiceFilesAccess }) {
  const [list, rules] = await Promise.all([listServices(vehicleId), getRules()]);
  // The demo has sample rows but no files behind them, so it shows no invoice controls (as on Renewals).
  const files = docs.canSee && !(await isDemo()) ? await attachmentsByOwner("vehicle_service", list.map((s) => s.id)) : null;
  const today = todayInAppTz(); // after the query, which opts this render into request time
  // The newest record of each type is the one whose next due date drives Reminders.
  const current = new Set(latestPerType(list, rules.oilChangeTypes).map((s) => s.id));
  const { serviceTypes } = appConfig.vehicles;

  return (
    <section aria-label="Services" className="flex flex-col gap-4">
      <div>
        <AddServiceSheet vehicleId={vehicleId} vehicleName={vehicleName} serviceTypes={serviceTypes} defaultDate={today} oil={rules} canAttach={docs.canAdd} />
      </div>

      {list.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No services recorded yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((s) => (
            <ServiceItem
              key={s.id}
              service={s}
              today={today}
              drivesReminder={current.has(s.id)}
              serviceTypes={serviceTypes}
              vehicleName={vehicleName}
              namePrefix={namePrefix}
              files={files ? (files.get(s.id) ?? []) : null}
              canAddFile={docs.canAdd}
            />
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
  vehicleName,
  namePrefix,
  files,
  canAddFile,
}: {
  service: VehicleService;
  today: string;
  drivesReminder: boolean;
  serviceTypes: readonly string[];
  vehicleName: string;
  namePrefix: string;
  /** Its invoices, or null when this person may not see Vehicle documents (or this is the demo). */
  files: Attachment[] | null;
  canAddFile: boolean;
}) {
  const days = s.nextDueDate ? daysBetween(today, s.nextDueDate) : null;
  const nameHint = docFileName({ vehicle: namePrefix, kind: SERVICE_FILE_KIND, date: s.serviceDate, ext: "pdf" }, (files ?? []).map((f) => f.fileName));
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
          <SubmitButton
            variant="ghost"
            size="icon"
            aria-label={`Delete service from ${formatDate(s.serviceDate)}`}
            confirm={files && files.length > 0 ? "Delete this service record and its files? This cannot be undone." : "Delete this service record? This cannot be undone."}
          >
            <Trash2 aria-hidden />
          </SubmitButton>
        </form>
      </div>
      {files && files.length === 0 && canAddFile ? (
        <div className="mt-1">
          <AddInvoiceSheet serviceId={s.id} serviceLabel={s.serviceType} vehicleName={vehicleName} nameHint={nameHint} />
        </div>
      ) : null}
      {files && files.length > 0 ? (
        <details className="mt-2 rounded-md border">
          <summary className="cursor-pointer px-3 py-1.5 text-sm text-muted-foreground">Files ({files.length})</summary>
          <div className="border-t p-3">
            <AttachmentsPanel owner={{ ownerType: "vehicle_service", ownerId: s.id }} items={files} nameHint={nameHint} />
          </div>
        </details>
      ) : null}
      <details className="mt-2 rounded-md border">
        <summary className="cursor-pointer px-3 py-1.5 text-sm text-muted-foreground">Edit</summary>
        <div className="border-t p-3">
          <ServiceForm action={updateService} serviceTypes={serviceTypes} service={s} />
        </div>
      </details>
    </li>
  );
}
