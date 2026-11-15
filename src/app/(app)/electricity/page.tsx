import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MonthlyChart } from "@/components/electricity/monthly-chart";
import { MeterForm } from "@/components/electricity/meter-form";
import { MeterCard } from "@/components/electricity/meter-card";
import { EmptyState, PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { isModuleEnabled } from "@/config/app.config";
import { createMeter } from "@/features/electricity/actions";
import { listAllBills, listAllReadings, listMeters } from "@/features/electricity/queries";
import { todayInAppTz } from "@/lib/format";

export const metadata: Metadata = { title: "Electricity" };

async function ElectricityContent({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const showArchived = (await searchParams).archived === "1";
  const [meters, readings, bills, archivedMeters] = await Promise.all([listMeters(showArchived), listAllReadings(), listAllBills(), listMeters(true)]);
  const today = todayInAppTz(); // after the queries, which opt this render into request time

  return (
    <>
      {meters.length === 0 ? (
        <EmptyState
          title={showArchived ? "No archived meters" : "No meters yet"}
          hint={showArchived ? "Meters you archive show up here with their history." : "Add your electricity meter(s) under Manage meters below, then log readings and bills."}
        />
      ) : (
        <ul className="grid items-start gap-4 md:grid-cols-2">
          {meters.map((m) => (
            <MeterCard key={m.id} meter={m} readings={readings.filter((r) => r.meterId === m.id)} bills={bills.filter((b) => b.meterId === m.id)} today={today} />
          ))}
        </ul>
      )}

      {!showArchived ? (
        <Suspense fallback={null}>
          <MonthlyChart />
        </Suspense>
      ) : null}

      {showArchived ? (
        <Link href="/electricity" className="text-sm underline-offset-2 hover:underline">
          ← Back to active meters
        </Link>
      ) : (
        <details className="@container rounded-lg border text-sm" open={meters.length === 0}>
          <summary className="cursor-pointer px-4 py-2.5 text-muted-foreground">Manage meters</summary>
          <div className="flex flex-col gap-4 border-t p-4">
            <div>
              <h2 className="mb-2 font-medium">Add a meter</h2>
              <MeterForm action={createMeter} />
            </div>
            {archivedMeters.length > 0 ? (
              <Link href="/electricity?archived=1" className="underline-offset-2 hover:underline">
                Show archived meters ({archivedMeters.length})
              </Link>
            ) : null}
          </div>
        </details>
      )}
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
