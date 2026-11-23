import { composeMessage, type Message, type Notice } from "./planner";
import type { Channel, SystemKind } from "./steps";

/**
 * A message the planner's steps do not make (Notifications N.3, C140): a test push, or the email saying
 * an iPhone stopped accepting pushes. It still goes through the send log like any other (one row, its
 * own dedupe key), so the unique indexes keep it to once. Pure.
 */
export function systemMessage(input: {
  recipient: string;
  channel: Channel;
  kind: SystemKind;
  dedupeKey: string;
  title: string;
  body: string;
  href: string;
  /** "YYYY-MM-DD" in the app time zone: the log's due date for it. */
  today: string;
}): Message {
  const { recipient, channel, kind, dedupeKey, title, body, href, today } = input;
  const notice: Notice = {
    item: { id: dedupeKey, title, dueDate: today, href, kind },
    event: kind,
    step: "system",
    channel,
    dedupeKey,
    dueDate: today,
    href,
    daysUntil: 0,
    title,
    body,
  };
  return composeMessage(recipient, channel, [notice]);
}
