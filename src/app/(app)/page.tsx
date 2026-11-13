import { Zap } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { DueSoonCard } from "@/components/reminders/due-soon-card";
import { EmptyState, PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { appConfig } from "@/config/app.config";

/**
 * Dashboard. "Due soon" is live (reminders engine, DECISIONS C36-C39); "Electricity since last
 * bill" is still an empty state until the electricity module is built (Phase 2).
 */
export default function Home() {
  return (
    <>
      <PageHeader title="Home" description={appConfig.tagline} />

      <div className="grid gap-4 md:grid-cols-2">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" aria-label="Loading due soon" />}>
          <DueSoonCard />
        </Suspense>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="size-4" aria-hidden /> Electricity since last bill
            </CardTitle>
            <CardDescription>Units used, days elapsed and daily average.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="No bill yet"
              hint="Add your meters and readings on the Electricity page; the usage since your last bill shows here once a bill is logged."
            />
            <Link href="/electricity" className="mt-3 inline-block text-sm font-medium underline-offset-2 hover:underline">
              Open Electricity
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
