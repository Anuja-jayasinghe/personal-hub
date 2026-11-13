import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VehicleCard } from "@/components/vehicles/vehicle-card";
import { isModuleEnabled } from "@/config/app.config";
import { countArchivedVehicles, listVehicles } from "@/features/vehicles/queries";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Vehicles" };

async function VehicleList({ showArchived }: { showArchived: boolean }) {
  const [list, archivedCount] = await Promise.all([listVehicles(showArchived), countArchivedVehicles()]);

  return (
    <>
      {list.length === 0 ? (
        <EmptyState
          title={showArchived ? "No archived vehicles" : "No vehicles yet"}
          hint={showArchived ? "Vehicles you archive (for example when sold) show up here." : "Add your first vehicle to start tracking services and renewals."}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((v) => (
            <VehicleCard key={v.id} vehicle={v} />
          ))}
        </ul>
      )}
      {showArchived ? (
        <Link href="/vehicles" className="text-sm underline-offset-2 hover:underline">
          ← Back to active vehicles
        </Link>
      ) : archivedCount > 0 ? (
        <Link href="/vehicles?archived=1" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
          Show archived ({archivedCount})
        </Link>
      ) : null}
    </>
  );
}

async function VehiclesContent({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const { archived } = await searchParams;
  return <VehicleList showArchived={archived === "1"} />;
}

export default function VehiclesPage(props: PageProps<"/vehicles">) {
  if (!isModuleEnabled("vehicles")) notFound();

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Vehicles" description="Services, licence and insurance renewals, fixes and notes." />
        <Link href="/vehicles/new" className={buttonVariants()}>
          Add vehicle
        </Link>
      </div>
      <Suspense fallback={<Skeleton className="h-28 w-full rounded-xl" aria-label="Loading vehicles" />}>
        <VehiclesContent searchParams={props.searchParams as Promise<{ archived?: string }>} />
      </Suspense>
    </>
  );
}
