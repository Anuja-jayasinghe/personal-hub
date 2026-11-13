import { BellRing } from "lucide-react";
import Link from "next/link";
import { ReminderList } from "@/components/reminders/reminder-list";
import { EmptyState } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { appConfig } from "@/config/app.config";
import { getReminders } from "@/features/reminders/load";

const SHOWN = 5; // DECISIONS C39: top 5 on Home; the Reminders page has everything

/** Home card: overdue items plus everything inside the largest lead time, top 5. Use inside <Suspense>. */
export async function DueSoonCard() {
  const { results, failedSources } = await getReminders();
  const { leadDays } = appConfig.reminders;
  const shown = results.slice(0, SHOWN);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="size-4" aria-hidden /> Due soon
        </CardTitle>
        <CardDescription>Renewals, services and tasks coming up.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {shown.length > 0 ? (
          <ReminderList results={shown} />
        ) : (
          <EmptyState
            title="Nothing due"
            hint="Tasks with a due date show up here as the date gets close. Vehicle renewals will too."
          />
        )}

        {failedSources.length > 0 ? (
          <p role="alert" className="text-sm text-destructive">
            Couldn&apos;t load reminders from: {failedSources.join(", ")}.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            Flags at
            {leadDays.map((d) => (
              <Badge key={d} variant="secondary">
                {d === 0 ? "on the day" : `${d}d`}
              </Badge>
            ))}
          </p>
          <Link href="/reminders" className="text-sm font-medium underline-offset-2 hover:underline">
            View all{results.length > SHOWN ? ` (${results.length})` : ""}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
