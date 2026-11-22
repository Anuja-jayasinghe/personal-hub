import { allows } from "@/features/people/access";
import { requirePage } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { PageTopBar } from "@/components/shell/page-header";
import { SriLankaPlate } from "@/components/vehicles/sl-plate";
import { VehicleManageMenu } from "@/components/vehicles/vehicle-manage-menu";
import { vehiclePath } from "@/features/vehicles/plate";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { OdometerSection } from "@/components/vehicles/odometer-section";
import { RenewalsTab } from "@/components/vehicles/renewals-tab";
import { NotesPanel } from "@/components/shared/notes-panel";
import { ServicesTab } from "@/components/vehicles/services-tab";
import { DocumentsTab } from "@/components/vehicles/documents-tab";
import { VehicleSummary } from "@/components/vehicles/vehicle-summary";
import { VehicleCover } from "@/components/vehicles/vehicle-cover";
import { appConfig, isModuleEnabled } from "@/config/app.config";
import { getVehicle } from "@/features/vehicles/queries";
import { findVehicleType } from "@/features/vehicles/vehicle-type";

export const metadata: Metadata = { title: "Vehicle" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "services", label: "Services" },
  { key: "renewals", label: "Renewals" },
  { key: "documents", label: "Documents" },
] as const;

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value ?? "—"}</dd>
    </div>
  );
}

async function VehicleContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; q?: string; sort?: string }>;
}) {
  const access = await requirePage({ area: "vehicles", level: "see" });
  const [{ id }, { tab, q, sort }] = await Promise.all([params, searchParams]);
  const vehicle = await getVehicle(id);
  if (!vehicle) notFound();
  // Old links by id move to the plate address, keeping the tab (S.6).
  const canonical = vehiclePath(vehicle);
  if (decodeURIComponent(id) !== canonical.slice("/vehicles/".length)) {
    const query = new URLSearchParams(Object.entries({ tab, q, sort }).filter((e): e is [string, string] => typeof e[1] === "string")).toString();
    redirect(query ? `${canonical}?${query}` : canonical);
  }
  // Documents only for people who may see Vehicle documents (S.8, C114).
  const tabs = TABS.filter((t) => t.key !== "documents" || allows(access, "vehicle_documents", "see"));
  const current = tabs.find((t) => t.key === tab) ?? tabs[0];
  const subtitle = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ");
  const type = findVehicleType(appConfig.vehicles.types, vehicle.vehicleType);

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
        <div className="flex justify-end px-4 pb-3 md:px-6">
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
        <div className="flex flex-col gap-8">
          <VehicleSummary vehicleId={vehicle.id} />
          <dl className="grid gap-4 sm:grid-cols-3">
            <Detail label="Type" value={type?.label} />
            <Detail label="Make" value={vehicle.make} />
            <Detail label="Model" value={vehicle.model} />
            <Detail label="Year" value={vehicle.year} />
            <Detail label="Fuel" value={vehicle.fuelType} />
            <Detail label="Registration" value={vehicle.registrationNumber} />
          </dl>

          <NotesPanel scope={{ kind: "owner", owner: { ownerType: "vehicle", ownerId: vehicle.id } }} title="Notes" quietWhenEmpty />

          <OdometerSection vehicleId={vehicle.id} vehicleName={vehicle.nickname} />
        </div>
      ) : current.key === "services" ? (
        <ServicesTab vehicleId={vehicle.id} vehicleName={vehicle.nickname} />
      ) : current.key === "renewals" ? (
        <RenewalsTab vehicleId={vehicle.id} vehicleName={vehicle.nickname} showDocuments={allows(access, "vehicle_documents", "see")} />
      ) : (
        <DocumentsTab vehicleId={vehicle.id} vehicleName={vehicle.nickname} coverAttachmentId={vehicle.coverAttachmentId} query={q ?? ""} sort={sort} />
      )}
    </>
  );
}

export default function VehiclePage(props: PageProps<"/vehicles/[id]">) {
  if (!isModuleEnabled("vehicles")) notFound();
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" aria-label="Loading vehicle" />}>
      <VehicleContent
        params={props.params as Promise<{ id: string }>}
        searchParams={props.searchParams as Promise<{ tab?: string; q?: string; sort?: string }>}
      />
    </Suspense>
  );
}
