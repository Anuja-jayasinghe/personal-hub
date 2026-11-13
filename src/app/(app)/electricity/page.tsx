import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState, PageHeader } from "@/components/shell/page-header";
import { isModuleEnabled } from "@/config/app.config";

export const metadata: Metadata = { title: "Electricity" };

export default function ElectricityPage() {
  if (!isModuleEnabled("electricity")) notFound();

  return (
    <>
      <PageHeader
        title="Electricity"
        description="Meter readings, bills and a running total since your last bill."
      />
      <EmptyState title="Coming in Phase 2" hint="This module is built after Vehicles." />
    </>
  );
}
