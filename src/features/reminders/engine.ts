import type { Db } from "@/db/read";
import { daysBetween } from "@/lib/dates";

/**
 * Reminders engine (PLAN.md step 0.8). Pure: it knows nothing about the database, the clock or
 * the app config — callers pass everything in — so the rules are easy to test.
 *
 * A module contributes dated items; the engine says how soon each one is. Lead times (default
 * 30, 14, 7, 1 and 0 days before the due date, DECISIONS C20) decide when an item first appears.
 */

export type ReminderItem = {
  /** Unique and stable, e.g. "task:<uuid>". */
  id: string;
  title: string;
  /** Calendar due date, "YYYY-MM-DD". */
  dueDate: string;
  /** Where to open the item in the app. */
  href: string;
  /** Short type label shown as a badge, e.g. "task", "insurance". */
  kind: string;
  /** Override the default lead times for this item (e.g. insurance renewals warn earlier). */
  leadDays?: readonly number[];
  /** The record this item belongs to (a vehicle's id), so lists can count what is due per record. */
  ownerId?: string;
  /**
   * Safe words for a notification (Notifications N.1, C139): `what` it is ("Insurance", "Electricity
   * bill") and `who` it is about (a vehicle's nickname, a meter's name). Never an amount, a plate or a
   * document number, unlike `title`, which may hold an amount.
   */
  notice?: { what: string; who?: string };
};

/**
 * overdue  — past its due date (stays until the item is done)
 * today    — due today
 * soon     — due in 1 to 7 days
 * upcoming — due in 8 days or more, but inside the item's largest lead time
 */
export type ReminderLevel = "overdue" | "today" | "soon" | "upcoming";

export type ReminderResult = {
  item: ReminderItem;
  /** Days until the due date; negative when overdue. */
  daysUntil: number;
  level: ReminderLevel;
  /**
   * The lead-time step this item is currently in: the smallest lead time that is still at or
   * beyond the days remaining (e.g. 10 days left with leads 30/14/7/1/0 gives 14). Null once overdue.
   */
  threshold: number | null;
};

/** "Soon" means due within this many days. */
export const SOON_DAYS = 7;

/**
 * Works out the level of each item as of `today` and drops items that are not yet inside their
 * largest lead time. Result is sorted most urgent first (most overdue, then soonest, then title).
 */
export function computeReminders(
  items: readonly ReminderItem[],
  today: string,
  defaultLeadDays: readonly number[],
): ReminderResult[] {
  const results: ReminderResult[] = [];

  for (const item of items) {
    const leads = item.leadDays && item.leadDays.length > 0 ? item.leadDays : defaultLeadDays;
    const maxLead = Math.max(...leads);
    const daysUntil = daysBetween(today, item.dueDate);

    if (daysUntil > maxLead) continue; // not due yet: too far away to show

    const level: ReminderLevel =
      daysUntil < 0 ? "overdue" : daysUntil === 0 ? "today" : daysUntil <= SOON_DAYS ? "soon" : "upcoming";

    const atOrBeyond = leads.filter((lead) => lead >= daysUntil);
    const threshold = daysUntil < 0 || atOrBeyond.length === 0 ? null : Math.min(...atOrBeyond);

    results.push({ item, daysUntil, level, threshold });
  }

  return results.sort((a, b) => a.daysUntil - b.daysUntil || a.item.title.localeCompare(b.item.title));
}

/** Groups results by level, keeping their order. */
export function groupByLevel(results: readonly ReminderResult[]): Record<ReminderLevel, ReminderResult[]> {
  const groups: Record<ReminderLevel, ReminderResult[]> = { overdue: [], today: [], soon: [], upcoming: [] };
  for (const r of results) groups[r.level].push(r);
  return groups;
}

/** Plain-English timing, e.g. "3 days overdue", "Today", "Tomorrow", "In 5 days". */
export function describeDays(daysUntil: number): string {
  if (daysUntil < -1) return `${-daysUntil} days overdue`;
  if (daysUntil === -1) return "1 day overdue";
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  return `In ${daysUntil} days`;
}

/**
 * Where a source reads from when there is no signed-in person: the daily notification run passes the
 * real database and the day (src/features/notifications/run.ts). Pages pass nothing, so the source reads
 * through `readDb()` (the demo for visitors) and the clock.
 */
export type SourceContext = { db: Db; today: string };

/** A module's contribution to the reminders list. Register it in sources.ts. */
export type ReminderSource = {
  key: string;
  label: string;
  load: (from?: SourceContext) => Promise<ReminderItem[]>;
};

/**
 * Something that is happening NOW rather than coming due (Notifications N.4, DECISIONS C142): a meter
 * close to its slab limit, a meter reading overdue, someone waiting for sign-up approval. Events are
 * never shown on the Reminders page or Home (those list dated items only): only the notification
 * planner reads them, from `noticeSources`. Their words are already safe: never an amount, a plate, a
 * document number, free text or a person's name or email.
 */
export type NoticeEvent = {
  /** Which kind it is: a key of NOTIFICATION_STEPS in src/features/notifications/steps.ts. */
  event: "slab-near" | "slab-over" | "reading-due" | "access-request";
  /**
   * Its dedupe key, unique per recipient: a notice is never sent twice for the same key. It names the
   * thing and its round: `slab:<meter>:near:<cycle start>`, `reading-due:<meter>:<last reading date>`,
   * `access-request:<person>`.
   */
  key: string;
  /** The day it is about (the cycle's start, the last reading, the day of the request): logged as the notice's date. */
  anchor: string;
  /** The first and last day ("YYYY-MM-DD") it may be sent: a missed run catches up inside the window. */
  from: string;
  until: string;
  /** Where it opens in the app: a path on the hub. */
  href: string;
  title: string;
  body: string;
};

/** A module's events for the notification planner (never the Reminders page). Register it in sources.ts under `noticeSources`. */
export type NoticeSource = {
  key: string;
  label: string;
  load: (from?: SourceContext) => Promise<NoticeEvent[]>;
};
