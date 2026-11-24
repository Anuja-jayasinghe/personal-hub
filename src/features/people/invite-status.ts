import { resendAvailability, resendRefusal } from "./invitation-config";

/**
 * How a waiting person (an invitation, issue #236, DECISIONS C154) looks in Settings › People. Pure: the
 * clock comes in, so the list is the same at any moment a test picks.
 */
export type InviteRow = {
  status: string;
  inviteSentAt: Date | null;
  inviteExpiresAt: Date | null;
  inviteOpenedAt: Date | null;
  inviteSendCount: number;
};

export type InviteView = {
  /** Past its end: shown as Expired, whatever the stored status (nobody has signed in since to flip it). */
  ended: boolean;
  /** "Invited · sent 3 days ago · ends in 11 days" or "Expired · ended 2 days ago". */
  line: string;
  /** "Opened" or "Not opened yet". */
  opened: string;
  canResend: boolean;
  /** Why Resend is not available now, or null. */
  resendNote: string | null;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/** "just now", "5 minutes ago", "3 hours ago", "3 days ago". */
export function agoText(from: Date, now: Date): string {
  const ms = Math.max(0, now.getTime() - from.getTime());
  if (ms < MINUTE) return "just now";
  if (ms < HOUR) return `${plural(Math.floor(ms / MINUTE), "minute")} ago`;
  if (ms < DAY) return `${plural(Math.floor(ms / HOUR), "hour")} ago`;
  return `${plural(Math.floor(ms / DAY), "day")} ago`;
}

/** "in 11 days", "in 5 hours", "in under an hour". */
export function inText(to: Date, now: Date): string {
  const ms = Math.max(0, to.getTime() - now.getTime());
  if (ms < HOUR) return "in under an hour";
  if (ms < DAY) return `in ${plural(Math.floor(ms / HOUR), "hour")}`;
  return `in ${plural(Math.floor(ms / DAY), "day")}`;
}

export function inviteView(row: InviteRow, now: Date): InviteView {
  const ended = row.status === "expired" || !row.inviteExpiresAt || row.inviteExpiresAt.getTime() <= now.getTime();
  const sent = row.inviteSentAt ? `sent ${agoText(row.inviteSentAt, now)}` : "not sent yet";
  const line = ended
    ? `Expired · ${row.inviteExpiresAt ? `ended ${agoText(row.inviteExpiresAt, now)}` : "ended"}`
    : `Invited · ${sent} · ends ${inText(row.inviteExpiresAt as Date, now)}`;
  const availability = resendAvailability(row, now);
  return {
    ended,
    line,
    opened: row.inviteOpenedAt ? "Opened" : "Not opened yet",
    canResend: availability.ok,
    resendNote: availability.ok ? null : resendRefusal(availability, now),
  };
}
