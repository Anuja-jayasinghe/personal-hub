import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SubmitButton } from "@/components/shared/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CoverPhotoForm } from "@/components/vehicles/cover-photo-form";
import { OdometerSection } from "@/components/vehicles/odometer-section";
import { RenewalsTab } from "@/components/vehicles/renewals-tab";
import { NotesPanel } from "@/components/shared/notes-panel";
import { ServicesTab } from "@/components/vehicles/services-tab";
import { DocumentsTab } from "@/components/vehicles/documents-tab";
import { VehicleSummary } from "@/components/vehicles/vehicle-summary";
import { VehicleCover } from "@/components/vehicles/vehicle-cover";
import { appConfig, isModuleEnabled } from "@/config/app.config";
import {
  archiveVehicle,
  deleteVehicle,
  removeVehicleCover,
  unarchiveVehicle,
} from "@/features/vehicles/actions";
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
  const [{ id }, { tab, q, sort }] = await Promise.all([params, searchParams]);
  const vehicle = await getVehicle(id);
  if (!vehicle) notFound();
  const current = TABS.find((t) => t.key === tab) ?? TABS[0];
  const subtitle = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ");
  const type = findVehicleType(appConfig.vehicles.types, vehicle.vehicleType);

  return (
    <>
      <section aria-label={vehicle.nickname} className="overflow-hidden rounded-3xl border border-raised bg-deepest">
        <div className="flex items-start gap-3 px-4 pt-4 md:px-6 md:pt-5">
          {vehicle.registrationNumber ? (
            <span className="shrink-0 rounded-lg bg-foreground px-2.5 py-1 font-mono text-[15px] font-semibold tracking-wide whitespace-nowrap text-background">{vehicle.registrationNumber}</span>
          ) : null}
          <div className="ml-auto min-w-0 text-right">
            <h1 className="truncate font-display text-2xl leading-tight font-semibold tracking-tight md:text-3xl">{vehicle.nickname}</h1>
            <p className="font-mono text-[10.5px] tracking-wide text-label uppercase">
              {[subtitle, type?.label, vehicle.fuelType].filter(Boolean).join(" · ")}
              {vehicle.archivedAt ? " · archived" : ""}
            </p>
          </div>
        </div>
        <VehicleCover
          vehicleId={vehicle.id}
          coverAttachmentId={vehicle.coverAttachmentId}
          vehicleType={vehicle.vehicleType}
          alt={`${vehicle.nickname} photo`}
          className="mx-auto h-44 w-full max-w-xl md:h-56"
        />
        <div className="flex justify-end px-4 pb-3 md:px-6">
          <Link href={`/vehicles/${vehicle.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Edit
          </Link>
        </div>
      </section>

      <nav aria-label="Vehicle sections" className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl bg-deepest p-1 ring-1 ring-border">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "overview" ? `/vehicles/${vehicle.id}` : `/vehicles/${vehicle.id}?tab=${t.key}`}
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

          <section aria-labelledby="cover" className="flex flex-col gap-3">
            <h2 id="cover" className="text-lg font-medium">
              Cover photo
            </h2>
            <CoverPhotoForm vehicleId={vehicle.id} hasCover={vehicle.coverAttachmentId !== null} />
            {vehicle.coverAttachmentId ? (
              <form action={removeVehicleCover}>
                <input type="hidden" name="id" value={vehicle.id} />
                <SubmitButton variant="ghost" size="sm" confirm="Remove the cover photo?">
                  Remove photo
                </SubmitButton>
              </form>
            ) : null}
          </section>

          <section aria-labelledby="danger" className="flex flex-col gap-3 rounded-xl border p-4">
            <h2 id="danger" className="text-lg font-medium">
              {vehicle.archivedAt ? "Archived" : "Sold or no longer yours?"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {vehicle.archivedAt
                ? "This vehicle is hidden from the list and sends no reminders, but its history is kept."
                : "Archive it to hide it and stop its reminders while keeping its history."}
            </p>
            <div className="flex flex-wrap gap-2">
              {vehicle.archivedAt ? (
                <form action={unarchiveVehicle}>
                  <input type="hidden" name="id" value={vehicle.id} />
                  <SubmitButton variant="outline">Unarchive</SubmitButton>
                </form>
              ) : (
                <form action={archiveVehicle}>
                  <input type="hidden" name="id" value={vehicle.id} />
                  <SubmitButton variant="outline" confirm={`Archive "${vehicle.nickname}"? You can unarchive it later.`}>
                    Archive
                  </SubmitButton>
                </form>
              )}
              <form action={deleteVehicle}>
                <input type="hidden" name="id" value={vehicle.id} />
                <SubmitButton
                  variant="destructive"
                  confirm={`Permanently delete "${vehicle.nickname}" with all its notes and files? This cannot be undone.`}
                >
                  Delete permanently
                </SubmitButton>
              </form>
            </div>
          </section>
        </div>
      ) : current.key === "services" ? (
        <ServicesTab vehicleId={vehicle.id} vehicleName={vehicle.nickname} />
      ) : current.key === "renewals" ? (
        <RenewalsTab vehicleId={vehicle.id} vehicleName={vehicle.nickname} />
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
