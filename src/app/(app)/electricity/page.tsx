import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MeterForm } from "@/components/electricity/meter-form";
import { MeterSection } from "@/components/electricity/meter-section";
import { EmptyState, PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { isModuleEnabled } from "@/config/app.config";
import { createMeter } from "@/features/electricity/actions";
import { listAllBills, listAllReadings, listMeters } from "@/features/electricity/queries";
import { attachmentsByOwner } from "@/features/shared/queries";
import { todayInAppTz } from "@/lib/format";

export const metadata: Metadata = { title: "Electricity" };

async function ElectricityContent({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const showArchived = (await searchParams).archived === "1";
  const [meters, readings, bills, archivedMeters] = await Promise.all([listMeters(showArchived), listAllReadings(), listAllBills(), listMeters(true)]);
  const billFiles = await attachmentsByOwner("electricity_bill", bills.map((b) => b.id));
  const today = todayInAppTz(); // after the queries, which opt this render into request time

  return (
    <>
      {!showArchived ? (
        <details className="rounded-lg border">
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">Add a meter</summary>
          <div className="border-t p-4">
            <MeterForm action={createMeter} />
          </div>
        </details>
      ) : null}

      {meters.length === 0 ? (
        <EmptyState
          title={showArchived ? "No archived meters" : "No meters yet"}
          hint={showArchived ? "Meters you archive show up here with their history." : "Add your electricity meter(s), then log readings and bills."}
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {meters.map((m) => (
            <MeterSection key={m.id} meter={m} readings={readings.filter((r) => r.meterId === m.id)} bills={bills.filter((b) => b.meterId === m.id)} billFiles={billFiles} today={today} />
          ))}
        </ul>
      )}

      {showArchived ? (
        <Link href="/electricity" className="text-sm underline-offset-2 hover:underline">
          ← Back to active meters
        </Link>
      ) : archivedMeters.length > 0 ? (
        <Link href="/electricity?archived=1" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
          Show archived ({archivedMeters.length})
        </Link>
      ) : null}
    </>
  );
}

export default function ElectricityPage(props: PageProps<"/electricity">) {
  if (!isModuleEnabled("electricity")) notFound();

  return (
    <>
      <PageHeader title="Electricity" description="Meter readings and bills, and what you have used since your last bill." />
      <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" aria-label="Loading electricity" />}>
        <ElectricityContent searchParams={props.searchParams as Promise<{ archived?: string }>} />
      </Suspense>
    </>
  );
}
