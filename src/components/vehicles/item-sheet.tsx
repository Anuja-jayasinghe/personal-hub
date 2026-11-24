import { FileText } from "lucide-react";
import { AttachmentsPanel } from "@/components/shared/attachments-panel";
import Link from "next/link";
import { DaysRing } from "@/components/shared/days-ring";
import { buttonVariants } from "@/components/ui/button";
import { ItemSheetShell } from "@/components/vehicles/item-sheet-shell";
import { RenewFromSheet, RenewalMenu, ServiceMenu } from "@/components/vehicles/item-sheet-parts";
import { PaperArt } from "@/components/vehicles/paper-art";
import { PaperViewer } from "@/components/vehicles/paper-viewer";
import { AddInvoiceSheet, AddScanSheet, EditRenewalSheet, EditServiceSheet } from "@/components/vehicles/vehicle-sheets";
import { appConfig } from "@/config/app.config";
import type { Attachment, Vehicle, VehicleRenewal, VehicleService } from "@/db/schema";
import type { Access } from "@/features/people/access";
import { getRules } from "@/features/settings/queries";
import { attachmentsByOwner } from "@/features/shared/queries";
import { docFileName, renewalKind, SERVICE_FILE_KIND } from "@/features/vehicles/doc-names";
import { renewalSheet, serviceSheet, type SheetFile } from "@/features/vehicles/item-sheet";
import { itemHref, oilState, pickItem, sheetAccess } from "@/features/vehicles/overview";
import { loadOverviewData } from "@/features/vehicles/overview-data";
import { daysWords, paperFromRenewal } from "@/features/vehicles/papers";
import { oilChangeWords } from "@/features/vehicles/service-logic";
import { vehiclePart } from "@/features/vehicles/doc-names";
import { isDemo } from "@/lib/auth";
import { formatBytes, formatDate, formatMoney, todayInAppTz } from "@/lib/format";

/**
 * The detail sheet of one renewal or service (V.2, C149; design canvas "Detail sheets"), opened by
 * `?item=renewal:<id>` / `?item=service:<id>` on any tab of the vehicle's page. The record is looked up ONLY among
 * this vehicle's own rows, so another vehicle's id, the wrong kind of id or a deleted record shows no sheet and no
 * error. What it offers follows the person's access, worked out here on the server (`sheetAccess`, `renewalSheet`,
 * `serviceSheet`): a person who may not see Vehicle documents is never given a file's name, size or link, and
 * Edit, Delete and Renew need Edit in Vehicles. Use inside <Suspense>.
 */

const toFile = (a: Attachment): SheetFile => ({ id: a.id, ownerType: a.ownerType, ownerId: a.ownerId, fileName: a.fileName, title: a.title, mimeType: a.mimeType, sizeBytes: a.sizeBytes, createdAt: a.createdAt });

const TONE_BOX = {
  ok: "border-status-ok/40 bg-status-ok-soft",
  soon: "border-status-soon-mark/45 bg-status-soon-soft",
  overdue: "border-status-overdue/45 bg-status-overdue-soft",
} as const;

const eyebrow = "font-mono text-[10.5px] tracking-[0.14em] uppercase";

export async function ItemSheet({
  vehicle,
  itemParam,
  basePath,
  closeHref,
  access,
}: {
  vehicle: Vehicle;
  /** The raw `?item=` value. */
  itemParam: string | undefined;
  /** The vehicle's own address (the plate), for links to other records. */
  basePath: string;
  /** The address without `item`, where closing goes. */
  closeHref: string;
  access: Access;
}) {
  if (!itemParam) return null;
  const data = await loadOverviewData(vehicle.id, vehicle.ignoreEmissionOdometer);
  const picked = pickItem(itemParam, data.renewals, data.services);
  if (!picked) return null;

  const [rules, sample] = await Promise.all([getRules(), isDemo()]);
  const sa = sheetAccess(access);
  const today = todayInAppTz(); // after the queries, which opt this render into request time
  const namePrefix = vehiclePart(vehicle);

  if (picked.kind === "renewal") {
    const r = picked.row;
    // The files are only asked for when this person may see Vehicle documents.
    const files = sa.canSeeFiles ? ((await attachmentsByOwner("vehicle_renewal", [r.id])).get(r.id) ?? []).map(toFile) : [];
    const model = renewalSheet({ renewal: r, renewals: data.renewals, files, today, access: sa, sample });
    return (
      <ItemSheetShell key={`renewal:${r.id}`} title={r.provider?.trim() || r.type} crumb={`${r.provider?.trim() ? `${r.type} · ` : `${vehicle.nickname} · `}${model.isCurrent ? "current" : "earlier"}`} closeHref={closeHref}>
        <RenewalContent r={r} model={model} vehicle={vehicle} basePath={basePath} namePrefix={namePrefix} sample={sample} today={today} />
      </ItemSheetShell>
    );
  }

  const s = picked.row;
  const files = sa.canSeeFiles && !sample ? ((await attachmentsByOwner("vehicle_service", [s.id])).get(s.id) ?? []).map(toFile) : [];
  const oil = oilState(data.services, rules, today, data.fitting);
  const model = serviceSheet({ service: s, services: data.services, oil, rules, files, today, access: sa, sample });
  return (
    <ItemSheetShell key={`service:${s.id}`} title={s.serviceType} crumb={`Service · ${formatDate(s.serviceDate)}`} closeHref={closeHref}>
      <ServiceContent s={s} model={model} vehicle={vehicle} namePrefix={namePrefix} rules={rules} />
    </ItemSheetShell>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="font-mono text-[10.5px] tracking-[0.08em] text-label uppercase">{term}</dt>
      <dd className="text-sm break-words">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// A renewal
// ---------------------------------------------------------------------------------------------

function RenewalContent({
  r,
  model,
  vehicle,
  basePath,
  namePrefix,
  sample,
  today,
}: {
  r: VehicleRenewal;
  model: ReturnType<typeof renewalSheet>;
  vehicle: Vehicle;
  basePath: string;
  namePrefix: string;
  sample: boolean;
  today: string;
}) {
  const types = appConfig.vehicles.renewalTypes.map((t) => t.label);
  const askOdometer = !vehicle.ignoreEmissionOdometer;
  // The reference number has not been used since C137; it never goes to the browser.
  const safe: VehicleRenewal = { ...r, referenceNumber: null };
  const files = model.files;
  const first = files?.[0];
  const facts = [r.startDate ? { term: "Valid from", value: formatDate(r.startDate) } : null, { term: "Until", value: formatDate(r.expiryDate) }, r.amount !== null ? { term: "Amount", value: formatMoney(Number(r.amount)) } : null].filter((f) => f !== null);

  return (
    <div className="flex flex-col gap-5">
      {model.isCurrent ? (
        <div className="flex items-center gap-4 rounded-2xl border bg-background p-3.5">
          <DaysRing days={model.days} ofDays={model.span} size={60} bare label={`${r.type}, ${model.days < 0 ? `${-model.days} days late` : `${model.days} days left`}`} />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[15px] font-semibold">{daysWords(model.days)}</span>
            <span className="text-[13px] text-muted-foreground">{model.days < 0 ? "Ended" : "Ends"} {formatDate(r.expiryDate)}</span>
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5 rounded-2xl border bg-background p-3.5">
          <span className="text-[15px] font-semibold">{r.renewedAt ? `Renewed ${formatDate(r.renewedAt)}` : "Replaced by a later one"}</span>
          <span className="text-[13px] text-muted-foreground">{r.expiryDate < today ? "Ended" : "Ends"} {formatDate(r.expiryDate)}</span>
        </div>
      )}

      <dl className="grid grid-cols-3 gap-x-3 gap-y-3.5">
        {facts.map((f) => (
          <Fact key={f.term} {...f} />
        ))}
      </dl>

      {files === null ? null : first ? (
        <PaperViewer
          paper={paperFromRenewal(r, files)}
          isCurrent={model.isCurrent}
          today={today}
          sample={sample}
          canEdit={model.can.replace}
          renew={null}
          ariaLabel={`Open the ${r.type.toLowerCase()} scan`}
          className="flex min-h-[78px] w-full items-center gap-3.5 rounded-2xl border bg-background p-3 text-left outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PaperArt kind={paperFromRenewal(r, files).kind} size="sm" />
          <span className="flex min-w-0 flex-col gap-1">
            <span className="font-mono text-xs break-all">{first.fileName}</span>
            <span className="text-[12.5px] text-label">
              {files.length > 1 ? `${files.length} files · ` : `${formatBytes(first.sizeBytes)} · added ${formatDate(first.createdAt)} · `}tap to view
            </span>
          </span>
        </PaperViewer>
      ) : (
        <div className="flex min-h-[64px] flex-wrap items-center gap-3 rounded-2xl border border-dashed p-3">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold">No scan yet</span>
            <span className="text-[12.5px] text-label">{model.can.addScan ? "The hub names the file for you." : "Nothing has been added."}</span>
          </span>
          {model.can.addScan ? <AddScanSheet renewalId={r.id} renewalType={r.type} vehicleName={vehicle.nickname} nameHint={docFileName({ vehicle: namePrefix, kind: renewalKind(r.type), date: r.expiryDate, ext: "pdf" }, [])} /> : null}
        </div>
      )}

      {model.earlier.length > 0 ? (
        <details className="group rounded-2xl border">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm text-muted-foreground">
            <span className="flex-1">
              Earlier {r.type.toLowerCase()} ({model.earlier.length})
            </span>
            <span aria-hidden className="transition-transform group-open:rotate-90">
              ▸
            </span>
          </summary>
          <ul className="flex flex-col divide-y border-t">
            {model.earlier.map((e) => (
              <li key={e.id}>
                <Link href={itemHref(basePath, { kind: "renewal", id: e.id })} replace scroll={false} className="flex min-h-11 items-center gap-3 px-4 py-2 text-sm hover:bg-muted/40">
                  <span className="flex-1">{e.startDate ? `${formatDate(e.startDate)} to ${formatDate(e.expiryDate)}` : `Until ${formatDate(e.expiryDate)}`}</span>
                  <span className="text-xs text-muted-foreground">{[e.provider?.trim(), e.amount !== null ? formatMoney(Number(e.amount)) : null].filter(Boolean).join(" · ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="flex flex-col gap-2.5">
        {model.can.renew ? <RenewFromSheet renewal={safe} vehicleName={vehicle.nickname} types={types} askOdometer={askOdometer} /> : null}
        {model.can.edit || model.can.download || model.can.replace || model.can.delete ? (
          <div className="flex gap-2.5">
            {model.can.edit ? (
              <div className="flex-1 [&>button]:w-full">
                <EditRenewalSheet renewal={safe} vehicleName={vehicle.nickname} types={types} askOdometer={askOdometer} />
              </div>
            ) : null}
            {model.can.download && first ? (
              <a href={`/files/${first.id}?download=1`} className={`${buttonVariants({ variant: "outline", size: "lg" })} flex-1`}>
                Download
              </a>
            ) : null}
            {model.can.replace || model.can.delete ? <RenewalMenu renewalId={r.id} type={r.type} replaceFileId={model.can.replace && first ? first.id : null} canDelete={model.can.delete} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// A service
// ---------------------------------------------------------------------------------------------

function ServiceContent({ s, model, vehicle, namePrefix, rules }: { s: VehicleService; model: ReturnType<typeof serviceSheet>; vehicle: Vehicle; namePrefix: string; rules: { oilChangeMonths: number; oilChangeKm: number } }) {
  const files = model.files;
  const facts = [
    s.garage?.trim() ? { term: "Garage", value: s.garage.trim() } : null,
    s.odometerKm !== null ? { term: "Odometer", value: `${s.odometerKm.toLocaleString("en-LK")} km` } : null,
    s.cost !== null ? { term: "Cost", value: formatMoney(Number(s.cost)) } : null,
  ].filter((f) => f !== null);
  const oil = model.oil;
  const oilTone = oil?.tone === "overdue" ? TONE_BOX.overdue : TONE_BOX.soon;

  return (
    <div className="flex flex-col gap-5">
      {oil ? (
        <div className={`flex flex-col gap-2 rounded-2xl border p-3.5 ${oilTone}`}>
          <span className={`${eyebrow} ${oil.tone === "overdue" ? "text-status-overdue" : "text-status-soon"}`}>Next oil change</span>
          {oil.current && oil.days !== null && oil.markerDate ? (
            <span className="flex items-baseline gap-2.5">
              <span className="font-display text-3xl leading-none font-semibold">{Math.abs(oil.days)}</span>
              <span className="text-sm font-semibold">
                {oil.days < 0 ? `${oil.days === -1 ? "day" : "days"} late, was due` : `${oil.days === 1 ? "day" : "days"} left, by`} {formatDate(oil.markerDate)}
              </span>
            </span>
          ) : oil.current ? (
            <span className="text-sm font-semibold">No reminder set for this one.</span>
          ) : (
            <span className="text-sm font-semibold">Replaced by a newer oil change.</span>
          )}
          <span className="text-[12.5px] text-muted-foreground">
            {oilChangeWords(rules)}
            {oil.km ? ` (${oil.km.driven.toLocaleString("en-LK")} km driven so far)` : ""}.
          </span>
        </div>
      ) : model.nextDue ? (
        <p className="text-sm">
          Next due {formatDate(model.nextDue.date)} <span className="text-muted-foreground">· {model.nextDue.reminds ? daysWords(model.nextDue.days).replace("Ends today", "Today") : "replaced by a newer record"}</span>
        </p>
      ) : null}

      {facts.length > 0 ? (
        <dl className="grid grid-cols-3 gap-x-3 gap-y-3.5">
          {facts.map((f) => (
            <Fact key={f.term} {...f} />
          ))}
        </dl>
      ) : null}

      {s.itemsDone ? <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{s.itemsDone}</p> : null}

      {files === null ? null : files.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {files.map((f) => (
            <li key={f.id}>
              <a
                href={`/files/${f.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-[78px] items-center gap-3.5 rounded-2xl border bg-background p-3 outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span aria-hidden className="flex size-[52px] shrink-0 items-center justify-center rounded-md bg-raised text-muted-foreground">
                  <FileText className="size-6" />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-mono text-xs break-all">{f.fileName}</span>
                  <span className="text-[12.5px] text-label">
                    The invoice · {formatBytes(f.sizeBytes)} · tap to view
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : model.can.addInvoice ? (
        <div className="flex min-h-[64px] flex-wrap items-center gap-3 rounded-2xl border border-dashed p-3">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold">No invoice yet</span>
            <span className="text-[12.5px] text-label">The hub names the file for you.</span>
          </span>
          <AddInvoiceSheet serviceId={s.id} serviceLabel={s.serviceType} vehicleName={vehicle.nickname} nameHint={docFileName({ vehicle: namePrefix, kind: SERVICE_FILE_KIND, date: s.serviceDate, ext: "pdf" }, [])} />
        </div>
      ) : null}

      {/* More than one file, or a second to add: the Services tab's file list moved here, tucked, because a service usually has one invoice (V.3, C150). */}
      {files && files.length > 0 && model.can.manageFiles ? (
        <details className="rounded-2xl border">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm text-muted-foreground">Manage files ({files.length})</summary>
          <div className="border-t p-4">
            <AttachmentsPanel owner={{ ownerType: "vehicle_service", ownerId: s.id }} items={files} nameHint={docFileName({ vehicle: namePrefix, kind: SERVICE_FILE_KIND, date: s.serviceDate, ext: "pdf" }, files.map((f) => f.fileName))} />
          </div>
        </details>
      ) : null}

      {model.can.edit || model.can.download || model.can.delete || model.can.deleteFile ? (
        <div className="flex gap-2.5">
          {model.can.edit ? (
            <div className="flex-1 [&>button]:w-full">
              <EditServiceSheet service={s} vehicleName={vehicle.nickname} serviceTypes={appConfig.vehicles.serviceTypes} />
            </div>
          ) : null}
          {model.can.download && files?.[0] ? (
            <a href={`/files/${files[0].id}?download=1`} className={`${buttonVariants({ variant: "outline", size: "lg" })} flex-1`}>
              Download
            </a>
          ) : null}
          {model.can.delete || model.can.deleteFile ? <ServiceMenu serviceId={s.id} serviceType={s.serviceType} deleteFileId={model.can.deleteFile && files?.[0] ? files[0].id : null} canDelete={model.can.delete} /> : null}
        </div>
      ) : null}
    </div>
  );
}
