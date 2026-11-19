import { getRules } from "@/features/settings/queries";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ElectricityBody } from "@/components/electricity/electricity-body";
import { PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { isModuleEnabled } from "@/config/app.config";
import { listAllBills, listAllReadings, listLiveSwitches, listMeters } from "@/features/electricity/queries";
import { currentLive } from "@/features/electricity/live";
import { todayInAppTz } from "@/lib/format";

export const metadata: Metadata = { title: "Electricity" };

type Search = { archived?: string; meter?: string };

async function ElectricityContent({ searchParams }: { searchParams: Promise<Search> }) {
  const { archived, meter } = await searchParams;
  const showArchived = archived === "1";
  const [active, archivedMeters, readings, bills, switches, rules] = await Promise.all([listMeters(false), listMeters(true), listAllReadings(), listAllBills(), listLiveSwitches(), getRules()]);
  const today = todayInAppTz(); // after the queries, which opt this render into request time

  return (
    <ElectricityBody
      meters={showArchived ? archivedMeters : active}
      allMeters={[...active, ...archivedMeters]}
      archivedCount={archivedMeters.length}
      readings={readings}
      bills={bills}
      live={currentLive(switches, active.map((m) => m.id))}
      rules={rules}
      today={today}
      showArchived={showArchived}
      meterParam={meter}
    />
  );
}

export default function ElectricityPage(props: PageProps<"/electricity">) {
  if (!isModuleEnabled("electricity")) notFound();

  return (
    <>
      <PageHeader title="Electricity" description="What you have used since your last bill, and what is left to pay." />
      <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" aria-label="Loading electricity" />}>
        <ElectricityContent searchParams={props.searchParams as Promise<Search>} />
      </Suspense>
    </>
  );
}
