import { Trash2 } from "lucide-react";
import { AttachmentsPanel } from "@/components/shared/attachments-panel";
import { SubmitButton } from "@/components/shared/submit-button";
import { RenewalForm } from "@/components/vehicles/renewal-form";
import { AddRenewalSheet } from "@/components/vehicles/vehicle-sheets";
import { DaysRing } from "@/components/shared/days-ring";
import { Badge } from "@/components/ui/badge";
import { appConfig } from "@/config/app.config";
import type { Attachment, VehicleRenewal } from "@/db/schema";
import { describeDays } from "@/features/reminders/engine";
import { attachmentsByOwner } from "@/features/shared/queries";
import { listRenewals } from "@/features/vehicles/queries";
import { isDemo } from "@/lib/auth";
import { deleteRenewal, renewRenewal, updateRenewal } from "@/features/vehicles/renewal-actions";
import { docFileName, renewalKind } from "@/features/vehicles/doc-names";
import { splitCurrentAndPast } from "@/features/vehicles/renewal-logic";
import { daysBetween } from "@/lib/dates";
import { formatDate, formatMoney, todayInAppTz } from "@/lib/format";

/**
 * The Renewals tab: current renewals with days left, a renewed action, documents, and history. A renewal's
 * papers are Vehicle documents (C114), so they only show to people who may see that section.
 */
export async function RenewalsTab({
  vehicleId,
  vehicleName,
  namePrefix,
  askOdometer = true,
  showDocuments,
}: {
  vehicleId: string;
  vehicleName: string;
  namePrefix: string;
  /** False when the vehicle's emission certificates print an inaccurate odometer (issue #184). */
  askOdometer?: boolean;
  showDocuments: boolean;
}) {
  const list = await listRenewals(vehicleId);
  // The demo has sample file rows but no files behind them (issue #187), so it shows no file links here.
  const files = showDocuments && !(await isDemo()) ? await attachmentsByOwner("vehicle_renewal", list.map((r) => r.id)) : null;
  const today = todayInAppTz(); // after the queries, which opt this render into request time
  const { current, past } = splitCurrentAndPast(list);
  const types = appConfig.vehicles.renewalTypes.map((t) => t.label);

  return (
    <section aria-label="Renewals" className="flex flex-col gap-4">
      <div>
        <AddRenewalSheet vehicleId={vehicleId} vehicleName={vehicleName} types={types} askOdometer={askOdometer} />
      </div>

      {current.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No current renewals. Add your revenue license, insurance and emission test to be reminded before they expire.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {current.map((r) => (
            <RenewalItem key={r.id} renewal={r} files={files ? (files.get(r.id) ?? []) : null} today={today} isCurrent types={types} namePrefix={namePrefix} askOdometer={askOdometer} />
          ))}
        </ul>
      )}

      {past.length > 0 ? (
        <details className="rounded-lg border">
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">History ({past.length})</summary>
          <ul className="flex flex-col gap-2 border-t p-3">
            {past.map((r) => (
              <RenewalItem key={r.id} renewal={r} files={files ? (files.get(r.id) ?? []) : null} today={today} isCurrent={false} types={types} namePrefix={namePrefix} askOdometer={askOdometer} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function RenewalItem({
  renewal: r,
  files,
  today,
  isCurrent,
  types,
  namePrefix,
  askOdometer,
}: {
  renewal: VehicleRenewal;
  files: Attachment[] | null;
  today: string;
  isCurrent: boolean;
  types: readonly string[];
  namePrefix: string;
  askOdometer: boolean;
}) {
  const days = daysBetween(today, r.expiryDate);
  const tone = days < 0 ? "font-medium text-status-overdue" : days <= 7 ? "text-status-soon" : "text-muted-foreground";

  return (
    <li className="rounded-2xl border bg-card p-3.5 text-card-foreground">
      <div className="flex items-start gap-3">
        {isCurrent ? (
          <DaysRing
            days={days}
            ofDays={r.startDate ? Math.max(1, daysBetween(r.startDate, r.expiryDate)) : 365}
            size={64}
            label={`${r.type}: ${days < 0 ? `${-days} days late` : `${days} days left`}`}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{r.type}</p>
            {r.renewedAt ? <Badge variant="secondary">Renewed {formatDate(r.renewedAt)}</Badge> : null}
            {!r.renewedAt && !isCurrent ? <Badge variant="secondary">Replaced by a later one</Badge> : null}
          </div>
          <p className="mt-1 text-sm">
            {r.startDate ? `${formatDate(r.startDate)} to ` : "Expires "}
            {formatDate(r.expiryDate)}
            {isCurrent ? <span className={` ${tone}`}> · {days === 0 ? "expires today" : days < 0 ? `expired ${-days} day${-days === 1 ? "" : "s"} ago` : `${describeDays(days).replace("In ", "")} left`}</span> : null}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {[r.provider, r.amount !== null ? formatMoney(Number(r.amount)) : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <form action={deleteRenewal}>
          <input type="hidden" name="id" value={r.id} />
          <SubmitButton variant="ghost" size="icon" aria-label={`Delete ${r.type} renewal expiring ${formatDate(r.expiryDate)}`} confirm="Delete this renewal and its documents? This cannot be undone.">
            <Trash2 aria-hidden />
          </SubmitButton>
        </form>
      </div>

      <div className="mt-2 flex flex-col gap-2">
        {isCurrent ? (
          <details className="rounded-md border border-primary/40">
            <summary className="cursor-pointer px-3 py-1.5 text-sm font-medium">Renewed</summary>
            <div className="border-t p-3">
              <RenewalForm mode="renew" action={renewRenewal} types={types} renewal={r} askOdometer={askOdometer} />
            </div>
          </details>
        ) : null}
        <details className="rounded-md border">
          <summary className="cursor-pointer px-3 py-1.5 text-sm text-muted-foreground">Edit</summary>
          <div className="border-t p-3">
            <RenewalForm mode="edit" action={updateRenewal} types={types} renewal={r} askOdometer={askOdometer} />
          </div>
        </details>
        {files ? (
          <details className="rounded-md border">
            <summary className="cursor-pointer px-3 py-1.5 text-sm text-muted-foreground">Documents ({files.length})</summary>
            <div className="border-t p-3">
              <AttachmentsPanel
                owner={{ ownerType: "vehicle_renewal", ownerId: r.id }}
                items={files}
                nameHint={docFileName({ vehicle: namePrefix, kind: renewalKind(r.type), date: r.expiryDate, ext: "pdf" }, files.map((f) => f.fileName))}
              />
            </div>
          </details>
        ) : null}
      </div>
    </li>
  );
}
