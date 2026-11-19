import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VehicleCard } from "@/components/vehicles/vehicle-card";
import { isModuleEnabled } from "@/config/app.config";
import { countByOwner } from "@/features/reminders/by-owner";
import { getReminders } from "@/features/reminders/load";
import { countArchivedVehicles, listVehicles } from "@/features/vehicles/queries";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Vehicles" };

async function VehicleList({ showArchived }: { showArchived: boolean }) {
  const [list, archivedCount, reminders] = await Promise.all([listVehicles(showArchived), countArchivedVehicles(), getReminders()]);
  // How many reminders each vehicle has (archived vehicles have none: their sources are skipped).
  const due = countByOwner(reminders.results);

  return (
    <>
      {list.length === 0 ? (
        <EmptyState
          title={showArchived ? "No archived vehicles" : "No vehicles yet"}
          hint={showArchived ? "Vehicles you archive (for example when sold) show up here." : "Add your first vehicle to start tracking services and renewals."}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((v) => (
            <VehicleCard key={v.id} vehicle={v} due={due.get(v.id)} />
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
      <PageHeader
        title="Vehicles"
        description="Services, licence and insurance renewals, and notes."
        actions={
          <Link href="/vehicles/new" className={buttonVariants()}>
            Add vehicle
          </Link>
        }
      />
      <Suspense fallback={<Skeleton className="h-28 w-full rounded-xl" aria-label="Loading vehicles" />}>
        <VehiclesContent searchParams={props.searchParams as Promise<{ archived?: string }>} />
      </Suspense>
    </>
  );
}
