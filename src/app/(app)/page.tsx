import { BellRing, Zap } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { appConfig } from "@/config/app.config";

/**
 * Dashboard skeleton (DECISIONS C32). Both cards are empty states for now:
 * "Due soon" is filled by the reminders engine (step 0.8), "Electricity since last bill" by
 * the electricity module (Phase 2).
 */
export default function Home() {
  const { leadDays } = appConfig.reminders;

  return (
    <>
      <PageHeader title="Home" description={appConfig.tagline} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="size-4" aria-hidden /> Due soon
            </CardTitle>
            <CardDescription>Renewals and services coming up.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <EmptyState
              title="Nothing due"
              hint="Once you add vehicles and their renewal dates, anything coming up shows here."
            />
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              Flags at
              {leadDays.map((d) => (
                <Badge key={d} variant="secondary">
                  {d === 0 ? "on the day" : `${d}d`}
                </Badge>
              ))}
            </p>
          </CardContent>
        </Card>

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
              hint="Add your last bill and a meter reading to see what you've used so far."
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
