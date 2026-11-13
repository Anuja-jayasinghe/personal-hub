import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState, PageHeader } from "@/components/shell/page-header";
import { isModuleEnabled } from "@/config/app.config";

export const metadata: Metadata = { title: "Vehicles" };

export default function VehiclesPage() {
  if (!isModuleEnabled("vehicles")) notFound();

  return (
    <>
      <PageHeader
        title="Vehicles"
        description="Services, licence and insurance renewals, fixes and notes."
      />
      <EmptyState title="Coming in Phase 1" hint="This module is built after the shell is done." />
    </>
  );
}
