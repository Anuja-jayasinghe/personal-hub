import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { VehicleForm } from "@/components/vehicles/vehicle-form";
import { appConfig, isModuleEnabled } from "@/config/app.config";
import { createVehicle } from "@/features/vehicles/actions";

export const metadata: Metadata = { title: "Add vehicle" };

export default function NewVehiclePage() {
  if (!isModuleEnabled("vehicles")) notFound();
  return (
    <>
      <PageHeader title="Add vehicle" description="Only the nickname is required; fill in the rest if you like." />
      <VehicleForm action={createVehicle} fuelTypes={appConfig.vehicles.fuelTypes} />
    </>
  );
}
