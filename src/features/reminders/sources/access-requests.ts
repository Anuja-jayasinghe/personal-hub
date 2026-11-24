import "server-only";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { appConfig } from "@/config/app.config";
import { readDb, type Db } from "@/db/read";
import { people } from "@/db/schema";
import { accessRequestEvent } from "@/features/people/notices";
import type { NoticeEvent, NoticeSource } from "../engine";

/**
 * One event per person waiting for the owner's approval, from the database it is given (Notifications
 * N.4, C142). Reads nothing but the person's id and when they were first seen, and says nothing about who
 * they are (no name, no email).
 */
export async function loadAccessRequestEvents(db: Db): Promise<NoticeEvent[]> {
  const pending = await db.select({ id: people.id, createdAt: people.createdAt }).from(people).where(eq(people.status, "pending"));
  return pending.map((p) => accessRequestEvent(p, appConfig.timeZone));
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
    if (from) return loadAccessRequestEvents(from.db);
    await connection();
    return loadAccessRequestEvents(await readDb());
  },
};
