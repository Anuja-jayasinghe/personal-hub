import { isDocKind, vehiclePart } from "@/features/vehicles/doc-names";
import { allows } from "@/features/people/access";
import { requirePage } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { PageTopBar } from "@/components/shell/page-header";
import { VehicleAddMenu } from "@/components/vehicles/vehicle-add-menu";
import { VehicleManageMenu } from "@/components/vehicles/vehicle-manage-menu";
import { vehiclePath } from "@/features/vehicles/plate";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ItemSheet } from "@/components/vehicles/item-sheet";
import { VehicleOverview } from "@/components/vehicles/overview";
import { DocumentsTab } from "@/components/vehicles/documents-tab";
import { VehicleHero } from "@/components/vehicles/vehicle-hero";
import { appConfig, isModuleEnabled } from "@/config/app.config";
import { getRules } from "@/features/settings/queries";
import { addChoices, hasAddChoice } from "@/features/vehicles/add-menu";
import { paperContext } from "@/features/vehicles/paper-context";
import { getVehicle, listRenewals } from "@/features/vehicles/queries";
import { todayInAppTz } from "@/lib/format";
import { landOnTab, redirectAddress, vehicleTabs } from "@/features/vehicles/tabs";
import { findVehicleType } from "@/features/vehicles/vehicle-type";

type SearchParams = { tab?: string; q?: string; kind?: string; item?: string };

export const metadata: Metadata = { title: "Vehicle" };

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
  // Documents only for people who may see Vehicle documents (S.8, C114).
  const canSeeDocuments = allows(access, "vehicle_documents", "see");
  const tabs = vehicleTabs(canSeeDocuments);
  // The old Services and Renewals tabs, a tab this person may not open and any unknown value land on the Overview (V.3, C150).
  const landing = landOnTab({ tab, item }, canSeeDocuments);
  const current = tabs.find((t) => t.key === landing.tab) ?? tabs[0];
  // Old links by id move to the plate address, keeping the tab (S.6); an old tab name moves to the Overview, keeping the item.
  const canonical = vehiclePath(vehicle);
  const wrongId = decodeURIComponent(id) !== canonical.slice("/vehicles/".length);
  const moveTo = redirectAddress({ canonical, wrongId, query: { tab, q, kind, item }, landing });
  if (moveTo) redirect(moveTo);
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
    // The page keeps a readable width on a very wide screen (about 2000 px): the content is centred in a 1400 px column.
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      <PageTopBar parent={{ href: "/vehicles", label: "Vehicles" }} />
      <VehicleHero vehicle={vehicle} subtitle={subtitle} typeLabel={type?.label}>
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
      </VehicleHero>

      {/* Two tabs, a segmented control as wide as the phone; a person who may not see Documents has only the Overview, so no bar. */}
      {tabs.length > 1 ? (
        <nav aria-label="Vehicle sections" className="grid w-full grid-cols-2 gap-1 rounded-xl bg-deepest p-1 ring-1 ring-border sm:w-fit sm:min-w-64">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.key === "overview" ? vehiclePath(vehicle) : vehiclePath(vehicle, `?tab=${t.key}`)}
              aria-current={t.key === current.key ? "page" : undefined}
              className={`flex min-h-11 items-center justify-center rounded-[10px] px-4 text-sm transition-colors ${
                t.key === current.key ? "bg-accent font-semibold text-foreground ring-1 ring-primary/45" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      ) : null}

      {current.key === "overview" ? (
        <VehicleOverview vehicle={vehicle} rules={rules} paper={paper} choices={choices} canEdit={allows(access, "vehicles", "edit")} />
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
    </div>
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
