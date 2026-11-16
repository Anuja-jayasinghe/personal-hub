import { daysBetween } from "@/lib/dates";

/**
 * "When did I last check this meter?" (2b.4, C83). Pure: dates in, words out. Only a reading someone
 * typed in counts as a check, not the reading printed on a bill.
 */

export type LastChecked = { state: "never" } | { state: "known"; date: string; days: number; overdue: boolean };

/** `date` is the newest reading's day ("YYYY-MM-DD") or null; `today` the same format; a check is overdue after `checkEveryDays`. */
export function lastChecked(date: string | null, today: string, checkEveryDays: number): LastChecked {
  if (date === null) return { state: "never" };
  const days = Math.max(0, daysBetween(date, today));
  return { state: "known", date, days, overdue: days >= checkEveryDays };
}

export function isOverdue(c: LastChecked): boolean {
  return c.state === "never" || c.overdue;
}

/** "Checked today", "Checked yesterday", "Checked 3 days ago", or "Never checked". */
export function checkedText(c: LastChecked): string {
  if (c.state === "never") return "Never checked";
  if (c.days === 0) return "Checked today";
  if (c.days === 1) return "Checked yesterday";
  return `Checked ${c.days} days ago`;
}

/** How long ago, without the word "Checked": "today", "yesterday", "6 days ago". */
function ago(c: Extract<LastChecked, { state: "known" }>): string {
  return c.days === 0 ? "today" : c.days === 1 ? "yesterday" : `${c.days} days ago`;
}

/**
 * One sentence when any meter is overdue for a check, naming each one; null when all are fresh.
 * "Time to read the meters: Meter A was last checked 6 days ago, Meter B has no reading yet."
 */
export function checkNudge(items: readonly { name: string; check: LastChecked }[]): string | null {
  const due = items.filter((i) => isOverdue(i.check));
  if (due.length === 0) return null;
  const parts = due.map((i) => (i.check.state === "never" ? `${i.name} has no reading yet` : `${i.name} was last checked ${ago(i.check)}`));
  return `Time to read the meters: ${parts.join(", ")}.`;
}
