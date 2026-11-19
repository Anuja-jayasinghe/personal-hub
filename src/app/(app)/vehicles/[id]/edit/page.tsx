import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { VehicleForm } from "@/components/vehicles/vehicle-form";
import { appConfig, isModuleEnabled } from "@/config/app.config";
import { updateVehicle } from "@/features/vehicles/actions";
import { getVehicle } from "@/features/vehicles/queries";

export const metadata: Metadata = { title: "Edit vehicle" };

async function EditContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vehicle = await getVehicle(id);
  if (!vehicle) notFound();
  return (
    <>
      <PageHeader title={`Edit ${vehicle.nickname}`} />
      <div className="max-w-3xl">
        <VehicleForm action={updateVehicle} fuelTypes={appConfig.vehicles.fuelTypes} vehicleTypes={appConfig.vehicles.types} vehicle={vehicle} />
      </div>
    </>
  );
}

export default function EditVehiclePage(props: PageProps<"/vehicles/[id]/edit">) {
  if (!isModuleEnabled("vehicles")) notFound();
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" aria-label="Loading" />}>
      <EditContent params={props.params as Promise<{ id: string }>} />
    </Suspense>
  );
}
