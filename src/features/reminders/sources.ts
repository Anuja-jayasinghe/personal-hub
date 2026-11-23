import "server-only";
import type { Area } from "@/features/people/access";
import { safeErrorSummary } from "@/lib/errors";
import type { ReminderItem, ReminderSource, SourceContext } from "./engine";
import { billItemsSource } from "./sources/bill-items";
import { electricityBillsSource } from "./sources/electricity-bills";
import { tasksSource } from "./sources/tasks";
import { vehicleRenewalsSource } from "./sources/vehicle-renewals";
import { vehicleServicesSource } from "./sources/vehicle-services";

/**
 * Every module that has dates worth reminding about adds one line here.
 */
export const reminderSources: ReminderSource[] = [tasksSource, vehicleServicesSource, vehicleRenewalsSource, electricityBillsSource, billItemsSource];

/** Which section each reminder source belongs to (S.8). A new source adds a line here. */
export const SOURCE_AREA: Record<string, Area> = {
  tasks: "tasks_notes",
  "vehicle-services": "vehicles",
  "vehicle-renewals": "vehicles",
  "electricity-bills": "electricity_bills",
  "bill-items": "bills",
};

export type LoadedSource = { key: string; area: Area; items: ReminderItem[] };

/**
 * Loads the given sources side by side. A source that throws is reported in `failedSources` (its
 * label) instead of blanking the others. `from` is for the daily notification run only (no signed-in
 * person, the real database); pages leave it out.
 */
export async function loadSources(
  sources: readonly ReminderSource[],
  from?: SourceContext,
): Promise<{ loaded: LoadedSource[]; failedSources: string[] }> {
  const settled = await Promise.allSettled(sources.map((s) => s.load(from)));
  const loaded = settled.flatMap((r, i) =>
    r.status === "fulfilled" ? [{ key: sources[i].key, area: SOURCE_AREA[sources[i].key] ?? "tasks_notes", items: r.value }] : [],
  );
  const failedSources = settled.flatMap((r, i) => {
    if (r.status === "fulfilled") return [];
    // Name and code only: a failed query's message carries its parameters (emails, titles).
    console.error(`Reminder source "${sources[i].key}" failed: ${safeErrorSummary(r.reason)}`);
    return [sources[i].label];
  });
  return { loaded, failedSources };
}
