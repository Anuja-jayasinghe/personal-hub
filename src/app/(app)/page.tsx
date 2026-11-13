import { Suspense } from "react";
import { UsageCard } from "@/components/electricity/usage-card";
import { DueSoonCard } from "@/components/reminders/due-soon-card";
import { PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { appConfig } from "@/config/app.config";

/**
 * Dashboard. "Due soon" (reminders engine, DECISIONS C36-C39) and "Electricity since last bill"
 * (Phase 2.3) are both live.
 */
export default function Home() {
  return (
    <>
      <PageHeader title="Home" description={appConfig.tagline} />

      <div className="grid gap-4 md:grid-cols-2">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" aria-label="Loading due soon" />}>
          <DueSoonCard />
        </Suspense>

        <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" aria-label="Loading electricity usage" />}>
          <UsageCard />
        </Suspense>
      </div>
    </>
  );
}
