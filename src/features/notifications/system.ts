import { composeMessage, type Message, type Notice } from "./planner";
import type { Channel, SystemKind } from "./steps";

/**
 * Notices the planner's steps do not make (Notifications N.3, C140): a test push, or the email saying
 * a device stopped accepting pushes. They still go through the send log like any other (one row each,
 * their own dedupe key), so the unique indexes keep each to once. Pure.
 */
export type SystemNoticeInput = {
  channel: Channel;
  kind: SystemKind;
  dedupeKey: string;
  title: string;
  body: string;
  href: string;
  /** "YYYY-MM-DD" in the app time zone: the log's due date for it. */
  today: string;
};

export function systemNotice({ channel, kind, dedupeKey, title, body, href, today }: SystemNoticeInput): Notice {
  return {
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
}

export function systemMessage(input: SystemNoticeInput & { recipient: string }): Message {
  return composeMessage(input.recipient, input.channel, [systemNotice(input)]);
}
