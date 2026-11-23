import "server-only";
import { getRules } from "@/features/settings/queries";
import { connection } from "next/server";
import { todayInAppTz } from "@/lib/format";
import { computeReminders, type ReminderResult } from "./engine";
import { loadSources, reminderSources, SOURCE_AREA } from "./sources";
import { allows } from "@/features/people/access";
import { getAccess } from "@/lib/auth";

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

  // Only the sections this person may see (S.8, C114); owners see every source.
  const access = await getAccess();
  const sources = reminderSources.filter((s) => access !== null && allows(access, SOURCE_AREA[s.key] ?? "tasks_notes", "see"));
  const { loaded, failedSources } = await loadSources(sources);
  const items = loaded.flatMap((l) => l.items);

  return { today, results: computeReminders(items, today, (await getRules()).leadDays), failedSources };
}
