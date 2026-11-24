import { isDocKind, vehiclePart } from "@/features/vehicles/doc-names";
import { allows } from "@/features/people/access";
import { requirePage } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { PageTopBar } from "@/components/shell/page-header";
import { SriLankaPlate } from "@/components/vehicles/sl-plate";
import { VehicleAddMenu } from "@/components/vehicles/vehicle-add-menu";
import { VehicleManageMenu } from "@/components/vehicles/vehicle-manage-menu";
import { vehiclePath } from "@/features/vehicles/plate";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ItemSheet } from "@/components/vehicles/item-sheet";
import { VehicleOverview } from "@/components/vehicles/overview";
import { RenewalsTab } from "@/components/vehicles/renewals-tab";
import { ServicesTab } from "@/components/vehicles/services-tab";
import { DocumentsTab } from "@/components/vehicles/documents-tab";
import { VehicleCover } from "@/components/vehicles/vehicle-cover";
import { appConfig, isModuleEnabled } from "@/config/app.config";
import { getRules } from "@/features/settings/queries";
import { addChoices, hasAddChoice } from "@/features/vehicles/add-menu";
import { paperContext } from "@/features/vehicles/paper-context";
import { getVehicle, listRenewals } from "@/features/vehicles/queries";
import { todayInAppTz } from "@/lib/format";
import { findVehicleType } from "@/features/vehicles/vehicle-type";

type SearchParams = { tab?: string; q?: string; kind?: string; item?: string };

export const metadata: Metadata = { title: "Vehicle" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "services", label: "Services" },
  { key: "renewals", label: "Renewals" },
  { key: "documents", label: "Documents" },
] as const;

async function VehicleContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const access = await requirePage({ area: "vehicles", level: "see" });
  const [{ id }, { tab, q, kind, item }] = await Promise.all([params, searchParams]);
  const vehicle = await getVehicle(id);
  if (!vehicle) notFound();
  // Old links by id move to the plate address, keeping the tab (S.6).
  const canonical = vehiclePath(vehicle);
  if (decodeURIComponent(id) !== canonical.slice("/vehicles/".length)) {
    const query = new URLSearchParams(Object.entries({ tab, q, kind, item }).filter((e): e is [string, string] => typeof e[1] === "string")).toString();
    redirect(query ? `${canonical}?${query}` : canonical);
  }
  // Documents only for people who may see Vehicle documents (S.8, C114).
  const tabs = TABS.filter((t) => t.key !== "documents" || allows(access, "vehicle_documents", "see"));
  const current = tabs.find((t) => t.key === tab) ?? tabs[0];
  const subtitle = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ");
  const type = findVehicleType(appConfig.vehicles.types, vehicle.vehicleType);
  // The one Add button (V.1a, C147): each choice only for a person who may do it, worked out here on the server.
  const choices = addChoices(access);
  const [rules, renewals] = await Promise.all([getRules(), listRenewals(vehicle.id)]);
  // Closing a sheet keeps the tab, the search and the category, and drops only the item.
  const keep = new URLSearchParams(Object.entries({ tab, q, kind }).filter((e): e is [string, string] => typeof e[1] === "string"));
  const closeHref = keep.size > 0 ? vehiclePath(vehicle, `?${keep.toString()}`) : vehiclePath(vehicle);
  const today = todayInAppTz(); // after the queries, which opt this render into request time
  // What the one flow for papers needs (V.1b): worked out here from the person's access, never in the browser.
  const paper = paperContext({
    vehicle,
    access,
    today,
    oil: { oilChangeMonths: rules.oilChangeMonths, oilChangeKm: rules.oilChangeKm, oilChangeTypes: rules.oilChangeTypes },
    renewals,
  });

  return (
    <>
      <PageTopBar parent={{ href: "/vehicles", label: "Vehicles" }} />
      <section aria-label={vehicle.nickname} className="overflow-hidden rounded-3xl border border-raised bg-deepest">
        <div className="flex items-start gap-3 px-4 pt-4 md:px-6 md:pt-5">
          {vehicle.registrationNumber ? <SriLankaPlate registration={vehicle.registrationNumber} size="lg" /> : null}
          <div className="ml-auto min-w-0 text-right">
            <h1 className="truncate font-display text-2xl leading-tight font-semibold tracking-tight md:text-3xl">{vehicle.nickname}</h1>
            <p className="font-mono text-[10.5px] tracking-wide text-label uppercase">
              {[subtitle, type?.label, vehicle.fuelType].filter(Boolean).join(" · ")}
              {vehicle.archivedAt ? " · archived" : ""}
            </p>
          </div>
        </div>
        <VehicleCover
          vehicle={vehicle}
          alt={`${vehicle.nickname} photo`}
          className="mx-auto h-44 w-full max-w-xl md:h-56"
        />
        <div className="flex items-center gap-2.5 px-4 pb-3 md:justify-end md:px-6">
          {hasAddChoice(choices) ? (
            <VehicleAddMenu
              vehicleId={vehicle.id}
              vehicleName={vehicle.nickname}
              paper={paper}
              choices={choices}
              serviceTypes={appConfig.vehicles.serviceTypes}
              defaultDate={today}
              oil={{ oilChangeMonths: rules.oilChangeMonths, oilChangeKm: rules.oilChangeKm, oilChangeTypes: rules.oilChangeTypes }}
            />
          ) : null}
          {allows(access, "vehicles", "edit") ? <VehicleManageMenu vehicle={vehicle} /> : null}
        </div>
      </section>

      <nav aria-label="Vehicle sections" className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl bg-deepest p-1 ring-1 ring-border">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "overview" ? vehiclePath(vehicle) : vehiclePath(vehicle, `?tab=${t.key}`)}
            aria-current={t.key === current.key ? "page" : undefined}
            className={`flex min-h-9 items-center rounded-[10px] px-3.5 text-sm transition-colors ${
              t.key === current.key ? "bg-accent font-semibold text-foreground ring-1 ring-primary/45" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {current.key === "overview" ? (
        <VehicleOverview vehicle={vehicle} rules={rules} />
      ) : current.key === "services" ? (
        <ServicesTab
          vehicleId={vehicle.id}
          vehicleName={vehicle.nickname}
          namePrefix={vehiclePart(vehicle)}
          docs={{ canSee: allows(access, "vehicle_documents", "see"), canAdd: allows(access, "vehicle_documents", "add") }}
        />
      ) : current.key === "renewals" ? (
        <RenewalsTab vehicleId={vehicle.id} namePrefix={vehiclePart(vehicle)} askOdometer={!vehicle.ignoreEmissionOdometer} showDocuments={allows(access, "vehicle_documents", "see")} paper={paper} />
      ) : (
        <DocumentsTab
          vehicleId={vehicle.id}
          vehicleName={vehicle.nickname}
          namePrefix={vehiclePart(vehicle)}
          coverAttachmentId={vehicle.coverAttachmentId}
          query={q ?? ""}
          kind={isDocKind(kind) ? kind : null}
          access={{
            canAdd: allows(access, "vehicle_documents", "add"),
            canEdit: allows(access, "vehicle_documents", "edit"),
            canRenew: allows(access, "vehicles", "edit"),
            canAddRenewal: allows(access, "vehicles", "add"),
          }}
          askOdometer={!vehicle.ignoreEmissionOdometer}
          basePath={vehiclePath(vehicle)}
          paper={paper}
        />
      )}

      {/* A record's detail sheet, opened by ?item= on any tab (V.2, C149). It looks the record up among THIS vehicle's own rows only. */}
      <Suspense fallback={null}>
        <ItemSheet vehicle={vehicle} itemParam={item} basePath={vehiclePath(vehicle)} closeHref={closeHref} access={access} />
      </Suspense>
    </>
  );
}

export default function VehiclePage(props: PageProps<"/vehicles/[id]">) {
  if (!isModuleEnabled("vehicles")) notFound();
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" aria-label="Loading vehicle" />}>
      <VehicleContent
        params={props.params as Promise<{ id: string }>}
        searchParams={props.searchParams as Promise<SearchParams>}
      />
    </Suspense>
  );
}
