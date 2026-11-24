import "server-only";
import type { SourceArea } from "@/features/people/access";
import { safeErrorSummary } from "@/lib/errors";
import type { NoticeEvent, NoticeSource, ReminderItem, ReminderSource, SourceContext } from "./engine";
import { accessRequestsSource } from "./sources/access-requests";
import { billItemsSource } from "./sources/bill-items";
import { electricityBillsSource } from "./sources/electricity-bills";
import { electricityNoticesSource } from "./sources/electricity-notices";
import { tasksSource } from "./sources/tasks";
import { vehicleRenewalsSource } from "./sources/vehicle-renewals";
import { vehicleServicesSource } from "./sources/vehicle-services";

/**
 * Every module that has dates worth reminding about adds one line here.
 */
export const reminderSources: ReminderSource[] = [tasksSource, vehicleServicesSource, vehicleRenewalsSource, electricityBillsSource, billItemsSource];

/**
 * Events for the notification planner only (N.4, C142): a slab limit, a reading overdue, a sign-up
 * request. They have no due date, so they are NOT in `reminderSources`: the Reminders page and Home never
 * list them. The daily run and Settings › Coming up read both lists.
 */
export const noticeSources: NoticeSource[] = [electricityNoticesSource, accessRequestsSource];

/** Which section each source belongs to (S.8). A new source adds a line here. */
export const SOURCE_AREA: Record<string, SourceArea> = {
  tasks: "tasks_notes",
  "vehicle-services": "vehicles",
  "vehicle-renewals": "vehicles",
  "electricity-bills": "electricity_bills",
  "bill-items": "bills",
  // Events (N.4): the meters' area, and the owner alone for sign-up requests.
  "electricity-notices": "electricity_readings",
  "access-requests": "owner",
};

export type LoadedSource<T = ReminderItem> = { key: string; area: SourceArea; items: T[] };
export type LoadedNoticeSource = LoadedSource<NoticeEvent>;

/**
 * Loads the given sources side by side. A source that throws is reported in `failedSources` (its
 * label) instead of blanking the others. `from` is for the daily notification run only (no signed-in
 * person, the real database); pages leave it out.
 */
export async function loadSources<T = ReminderItem>(
  sources: readonly { key: string; label: string; load: (from?: SourceContext) => Promise<T[]> }[],
  from?: SourceContext,
  /** The section of a source with no line in SOURCE_AREA. Event sources pass "owner": a source nobody mapped is heard by nobody else. */
  fallbackArea: SourceArea = "tasks_notes",
): Promise<{ loaded: LoadedSource<T>[]; failedSources: string[] }> {
  const settled = await Promise.allSettled(sources.map((s) => s.load(from)));
  const loaded = settled.flatMap((r, i) =>
    r.status === "fulfilled" ? [{ key: sources[i].key, area: SOURCE_AREA[sources[i].key] ?? fallbackArea, items: r.value }] : [],
  );
  const failedSources = settled.flatMap((r, i) => {
    if (r.status === "fulfilled") return [];
    // Name and code only: a failed query's message carries its parameters (emails, titles).
    console.error(`Reminder source "${sources[i].key}" failed: ${safeErrorSummary(r.reason)}`);
    return [sources[i].label];
  });
  return { loaded, failedSources };
}

/**
 * Loads event sources (N.4). Fails closed: an event source with no line in SOURCE_AREA belongs to the
 * owners alone, so forgetting the line can never show an owner-only notice to someone else (N.5).
 */
export function loadNoticeSources(sources: readonly NoticeSource[], from?: SourceContext) {
  return loadSources<NoticeEvent>(sources, from, "owner");
}
