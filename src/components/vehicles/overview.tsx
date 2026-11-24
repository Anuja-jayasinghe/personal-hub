import { NotesPanel } from "@/components/shared/notes-panel";
import { GlanceCards } from "@/components/vehicles/glance-cards";
import { NewVehicleChecklist } from "@/components/vehicles/new-vehicle-checklist";
import { AllClearBar, NeedsYouBar } from "@/components/vehicles/needs-you-bar";
import { OverviewServices } from "@/components/vehicles/overview-services";
import { ScrollToAnchor } from "@/components/vehicles/scroll-to-anchor";
import { OdometerSection } from "@/components/vehicles/odometer-section";
import { OverviewTimeline, type TimelineRow } from "@/components/vehicles/overview-timeline";
import { appConfig } from "@/config/app.config";
import type { Vehicle } from "@/db/schema";
import type { HubRules } from "@/features/settings/rules";
import type { AddChoices } from "@/features/vehicles/add-menu";
import { loadDocumentKinds } from "@/features/vehicles/documents-data";
import type { PaperContext } from "@/features/vehicles/paper-flow";
import { itemHref } from "@/features/vehicles/overview";
import { loadOverviewData } from "@/features/vehicles/overview-data";
import { buildOverviewModel } from "@/features/vehicles/overview-model";
import { RENEWALS_ANCHOR } from "@/features/vehicles/tabs";
import { vehiclePath } from "@/features/vehicles/plate";
import { findVehicleType } from "@/features/vehicles/vehicle-type";
import { isDemo } from "@/lib/auth";
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

export async function VehicleOverview({
  vehicle,
  rules,
  paper,
  choices,
  canEdit,
}: {
  vehicle: Vehicle;
  rules: HubRules;
  /** What the person may add (worked out on the server): the checklist offers only those kinds. */
  paper: PaperContext;
  choices: AddChoices;
  /** Edit in Vehicles: changing or deleting a typed odometer reading. */
  canEdit: boolean;
}) {
  // The demo shows the checklist as a sample (it adds nothing); a real see-only person never gets one.
  const sample = await isDemo();
  const can = sample ? { records: true, files: true } : paper.can;
  // The kinds of the vehicle's own documents are only read for a person who may add papers as files, and only for a vehicle still in use.
  const [data, documentKinds] = await Promise.all([
    loadOverviewData(vehicle.id, vehicle.ignoreEmissionOdometer),
    can.files && !vehicle.archivedAt ? loadDocumentKinds(vehicle.id, vehicle.coverAttachmentId) : Promise.resolve([]),
  ]);
  const today = todayInAppTz(); // after the queries, which opt this render into request time
  const basePath = vehiclePath(vehicle);
  const { renewals, services, readings, fitting } = data;

  const model = buildOverviewModel({
    today,
    timeZone: appConfig.timeZone,
    archived: vehicle.archivedAt !== null,
    renewals,
    services,
    readings,
    fitting,
    documentKinds,
    rules,
    renewalLeadDays: new Map(appConfig.vehicles.renewalTypes.map((t) => [t.label, t.leadDays])),
    can,
    choices,
    askOdometer: paper.askOdometer,
  });
  const { blank, attention, cards, checklist, footnote } = model;
  const rows: TimelineRow[] = model.timeline.map((e) => ({
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
      <ScrollToAnchor />
      {blank ? (
        checklist ? (
          <NewVehicleChecklist checklist={checklist} ctx={paper} note={footnote} readOnly={sample} />
        ) : (
          <p className="px-1 text-sm text-muted-foreground">Nothing recorded yet.{footnote ? ` ${footnote}` : ""}</p>
        )
      ) : (
        <>
          {/* "All clear" only when something is being watched: with no renewal and no next-due date there is nothing to be clear about. */}
          {model.bar === "needs" ? <NeedsYouBar needs={attention.needs} basePath={basePath} /> : model.bar === "clear" ? <AllClearBar next={attention.next} /> : null}
          <div id={RENEWALS_ANCHOR} className="scroll-mt-4">
            <GlanceCards cards={cards} basePath={basePath} />
          </div>
          {checklist ? <NewVehicleChecklist checklist={checklist} ctx={paper} note={null} readOnly={sample} /> : null}
        </>
      )}

      {blank ? null : (
        <div className="grid items-start gap-4 md:gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-4 md:gap-5">
            {model.show.services ? (
              <OverviewServices
                firstShown={SERVICES_SHOWN}
                rows={services.map((s) => ({
                  id: s.id,
                  title: s.serviceType,
                  detail: [formatDate(s.serviceDate), s.odometerKm !== null ? `${s.odometerKm.toLocaleString("en-LK")} km` : null, s.garage?.trim() || null].filter(Boolean).join(" · "),
                  cost: s.cost !== null ? formatMoney(Number(s.cost)) : null,
                  href: itemHref(basePath, { kind: "service", id: s.id }),
                }))}
              />
            ) : null}

            <OdometerSection
              vehicleId={vehicle.id}
              vehicleName={vehicle.nickname}
              ignoreEmissionOdometer={vehicle.ignoreEmissionOdometer}
              readings={readings}
              services={services}
              renewals={renewals}
              canAdd={choices.reading}
              canEdit={canEdit}
            />
          </div>

          {model.show.timeline ? <OverviewTimeline rows={rows} /> : null}
        </div>
      )}

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
