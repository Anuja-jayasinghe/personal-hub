import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/components/shell/page-header";
import { SubmitButton } from "@/components/shared/submit-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CoverPhotoForm } from "@/components/vehicles/cover-photo-form";
import { ServicesTab } from "@/components/vehicles/services-tab";
import { VehicleCover } from "@/components/vehicles/vehicle-cover";
import { isModuleEnabled } from "@/config/app.config";
import {
  archiveVehicle,
  deleteVehicle,
  removeVehicleCover,
  unarchiveVehicle,
} from "@/features/vehicles/actions";
import { getVehicle } from "@/features/vehicles/queries";

export const metadata: Metadata = { title: "Vehicle" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "services", label: "Services" },
  { key: "renewals", label: "Renewals", soon: "Coming in Phase 1.3: revenue license, insurance and emission test." },
  { key: "fixes", label: "Fixes", soon: "Coming in Phase 1.4: fixes for this vehicle." },
  { key: "notes", label: "Notes", soon: "Coming in Phase 1.4: notes and files for this vehicle." },
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
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const vehicle = await getVehicle(id);
  if (!vehicle) notFound();
  const current = TABS.find((t) => t.key === tab) ?? TABS[0];
  const subtitle = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ");

  return (
    <>
      <header className="flex flex-wrap items-center gap-4">
        <VehicleCover coverAttachmentId={vehicle.coverAttachmentId} alt={`${vehicle.nickname} photo`} className="size-20 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{vehicle.nickname}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {subtitle ? <span>{subtitle}</span> : null}
            {vehicle.registrationNumber ? <Badge variant="outline">{vehicle.registrationNumber}</Badge> : null}
            {vehicle.archivedAt ? <Badge variant="secondary">Archived</Badge> : null}
          </div>
        </div>
        <Link href={`/vehicles/${vehicle.id}/edit`} className={buttonVariants({ variant: "outline" })}>
          Edit
        </Link>
      </header>

      <nav aria-label="Vehicle sections" className="-mb-2 flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "overview" ? `/vehicles/${vehicle.id}` : `/vehicles/${vehicle.id}?tab=${t.key}`}
            aria-current={t.key === current.key ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              t.key === current.key ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {current.key === "overview" ? (
        <div className="flex flex-col gap-8">
          <dl className="grid gap-4 sm:grid-cols-3">
            <Detail label="Make" value={vehicle.make} />
            <Detail label="Model" value={vehicle.model} />
            <Detail label="Year" value={vehicle.year} />
            <Detail label="Fuel" value={vehicle.fuelType} />
            <Detail label="Registration" value={vehicle.registrationNumber} />
            <Detail label="Odometer" value={vehicle.odometerKm === null ? null : `${vehicle.odometerKm.toLocaleString("en-LK")} km`} />
          </dl>

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
                  confirm={`Permanently delete "${vehicle.nickname}" with all its tasks, notes and files? This cannot be undone.`}
                >
                  Delete permanently
                </SubmitButton>
              </form>
            </div>
          </section>
        </div>
      ) : current.key === "services" ? (
        <ServicesTab vehicleId={vehicle.id} />
      ) : (
        <EmptyState title={current.label} hint={"soon" in current ? current.soon : ""} />
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
        searchParams={props.searchParams as Promise<{ tab?: string }>}
      />
    </Suspense>
  );
}
