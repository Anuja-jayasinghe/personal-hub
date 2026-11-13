import "server-only";
import { connection } from "next/server";
import { appConfig } from "@/config/app.config";
import { todayInAppTz } from "@/lib/format";
import { computeReminders, type ReminderResult } from "./engine";
import { reminderSources } from "./sources";

export type RemindersData = {
  /** The calendar day used for the calculation, in the app time zone. */
  today: string;
  results: ReminderResult[];
  /** Labels of sources that failed to load; the others still show. */
  failedSources: string[];
};

/**
 * Loads every registered source and computes what is due. A source that throws (for example a
 * database hiccup) is reported in `failedSources` instead of blanking the whole list.
 * Request-time only: reads the database and the clock.
 */
export async function getReminders(): Promise<RemindersData> {
  await connection();
  const today = todayInAppTz();

  const settled = await Promise.allSettled(reminderSources.map((s) => s.load()));
  const items = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const failedSources = settled.flatMap((r, i) => {
    if (r.status === "fulfilled") return [];
    console.error(`Reminder source "${reminderSources[i].key}" failed:`, r.reason);
    return [reminderSources[i].label];
  });

  return { today, results: computeReminders(items, today, appConfig.reminders.leadDays), failedSources };
}
