import "server-only";
import { getRules } from "@/features/settings/queries";
import { connection } from "next/server";
import { todayInAppTz } from "@/lib/format";
import { computeReminders, type ReminderResult } from "./engine";
import { reminderSources } from "./sources";
import { allows, type Area } from "@/features/people/access";
import { getAccess } from "@/lib/auth";

/** Which section each reminder source belongs to (S.8). A new source adds a line here. */
const SOURCE_AREA: Record<string, Area> = {
  tasks: "tasks_notes",
  "vehicle-services": "vehicles",
  "vehicle-renewals": "vehicles",
  "electricity-bills": "electricity_bills",
  "bill-items": "bills",
};

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
  const settled = await Promise.allSettled(sources.map((s) => s.load()));
  const items = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const failedSources = settled.flatMap((r, i) => {
    if (r.status === "fulfilled") return [];
    console.error(`Reminder source "${sources[i].key}" failed:`, r.reason);
    return [sources[i].label];
  });

  return { today, results: computeReminders(items, today, (await getRules()).leadDays), failedSources };
}
