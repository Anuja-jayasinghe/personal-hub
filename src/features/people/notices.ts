import type { NoticeEvent } from "@/features/reminders/engine";
import { EVENT_WINDOW_DAYS } from "@/features/notifications/steps";
import { addDays, todayIn } from "@/lib/dates";

/**
 * "Someone asked for access" (Notifications N.4, DECISIONS C142). Pure: a pending person's id and the
 * moment they were first seen in, one event out. The words say nothing about who: no name, no email.
 * The key is per person, so each request is announced once, and the window gives a held notice (a push
 * already went that day) the next daily run to go out in.
 */
export const PEOPLE_HREF = "/settings/people";

export function accessRequestEvent(person: { id: string; createdAt: Date }, timeZone: string): NoticeEvent {
  const day = todayIn(timeZone, person.createdAt);
  return {
    event: "access-request",
    key: `access-request:${person.id}`,
    anchor: day,
    from: day,
    until: addDays(day, EVENT_WINDOW_DAYS),
    href: PEOPLE_HREF,
    title: "Someone asked for access",
    body: "Open People to review",
  };
}
