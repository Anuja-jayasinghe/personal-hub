import { requirePage } from "@/lib/auth";
import { getRules } from "@/features/settings/queries";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ReminderList } from "@/components/reminders/reminder-list";
import { ReminderStrip } from "@/components/reminders/reminder-strip";
import { EmptyState, PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { appConfig } from "@/config/app.config";
import { groupByLevel, type ReminderLevel } from "@/features/reminders/engine";
import { getReminders } from "@/features/reminders/load";
import { reminderStrip } from "@/features/reminders/strip";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Reminders" };

const groupTitles: Record<ReminderLevel, string> = {
  overdue: "Overdue",
  today: "Today",
  soon: "Next 7 days",
  upcoming: "Next 30 days",
};
const groupOrder: ReminderLevel[] = ["overdue", "today", "soon", "upcoming"];

async function Reminders() {
  await requirePage({ area: "reminders", level: "see" });
  const { today, results, failedSources } = await getReminders();
  const groups = groupByLevel(results);
  const { leadDays } = await getRules();
  const strip = reminderStrip(results, today);

  return (
    <>
      <ReminderStrip strip={strip} />

      {failedSources.length > 0 ? (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t load reminders from: {failedSources.join(", ")}. The
          rest are shown below.
        </p>
      ) : null}

      {results.length === 0 ? (
        <EmptyState
          title="Nothing due"
          hint={`Nothing is overdue or due within ${Math.max(...leadDays)} days. Tasks with a due date appear here as the date gets close.`}
        />
      ) : (
        // The groups sit side by side when there is room, so the page uses its width (issue #159).
        <div className="@container">
          <div className="grid items-start gap-6 @4xl:grid-cols-2 @[110rem]:grid-cols-3">
            {groupOrder
              .filter((level) => groups[level].length > 0)
              .map((level) => (
                <section
                  key={level}
                  aria-labelledby={`g-${level}`}
                  className="flex min-w-0 flex-col gap-2"
                >
                  <h2
                    id={`g-${level}`}
                    className={`font-mono text-[10.5px] font-normal tracking-[0.14em] uppercase ${level === "overdue" ? "text-status-overdue" : "text-label"}`}
                  >
                    {groupTitles[level]} · {groups[level].length}
                  </h2>
                  <ReminderList results={groups[level]} />
                </section>
              ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Today is {formatDate(today)} ({appConfig.timeZone}). Items are flagged{" "}
        {leadDays.filter((d) => d > 0).join(", ")} days before the due date and
        on the day; overdue items stay until done.
      </p>
    </>
  );
}

export default function RemindersPage() {
  return (
    <>
      <PageHeader
        title="Reminders"
        description="Everything overdue or coming up soon, across all modules."
      />
      <Suspense
        fallback={
          <Skeleton
            className="h-48 w-full rounded-xl"
            aria-label="Loading reminders"
          />
        }
      >
        <Reminders />
      </Suspense>
    </>
  );
}
