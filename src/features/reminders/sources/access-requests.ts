import "server-only";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { connection } from "next/server";
import { appConfig } from "@/config/app.config";
import { readDb, type Db } from "@/db/read";
import { people } from "@/db/schema";
import { EVENT_WINDOW_DAYS } from "@/features/notifications/steps";
import { accessRequestEvent } from "@/features/people/notices";
import { addDays } from "@/lib/dates";
import { todayInAppTz } from "@/lib/format";
import type { NoticeEvent, NoticeSource } from "../engine";

/** At most this many requests become events at once, so one send never nears Postgres' parameter limit. */
export const MAX_ACCESS_REQUESTS = 50;

/**
 * One event per person waiting for the owner's approval, from the database it is given (Notifications
 * N.4, C142). Reads nothing but the person's id and when they were first seen, and says nothing about who
 * they are (no name, no email). Bounded: only people first seen in the last EVENT_WINDOW_DAYS + 1 days
 * (older ones are past their window anyway), newest first, at most MAX_ACCESS_REQUESTS. If there are more,
 * the newest event carries the number left out (`extra`), so the message still says the true count; the
 * rest are announced by the next run.
 */
export async function loadAccessRequestEvents(db: Db, today: string): Promise<NoticeEvent[]> {
  const since = new Date(`${addDays(today, -(EVENT_WINDOW_DAYS + 1))}T00:00:00Z`);
  const recent = and(eq(people.status, "pending"), gte(people.createdAt, since));
  const [rows, [total]] = await Promise.all([
    db.select({ id: people.id, createdAt: people.createdAt }).from(people).where(recent).orderBy(desc(people.createdAt)).limit(MAX_ACCESS_REQUESTS),
    db.select({ n: count() }).from(people).where(recent),
  ]);
  const events = rows.map((p) => accessRequestEvent(p, appConfig.timeZone));
  const left = (total?.n ?? 0) - rows.length;
  if (left > 0 && events.length > 0) events[0] = { ...events[0], extra: left };
  return events;
}

/**
 * People waiting for approval, as events for the daily run (N.4): it announces a request whose instant
 * push was held back (a push had already gone that day) or never ran. Owner only. Never shown on the
 * Reminders page. Without a database passed in (Settings › Coming up, owner only) it reads through `readDb()`.
 */
export const accessRequestsSource: NoticeSource = {
  key: "access-requests",
  label: "Sign-up requests",
  async load(from) {
    if (from) return loadAccessRequestEvents(from.db, from.today);
    await connection();
    return loadAccessRequestEvents(await readDb(), todayInAppTz());
  },
};
