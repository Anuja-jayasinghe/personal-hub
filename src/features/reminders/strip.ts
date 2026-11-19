import { addDays, daysBetween } from "@/lib/dates";
import type { ReminderResult } from "./engine";

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

export type StripDay = {
  date: string;
  /** Day of the month. */
  n: number;
  /** One-letter weekday. */
  weekday: string;
  /** Things due that day (overdue ones are counted on today). */
  due: number;
  /** How many of those are overdue (only ever on today). */
  late: number;
};

/**
 * The three-week strip at the top of Reminders (R.5b, board HReminders): one cell per day from today,
 * with how many things are due on it. Overdue items are gathered on today. Pure.
 */
export function reminderStrip(results: readonly ReminderResult[], today: string, days = 21): StripDay[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i);
    const [y, m, d] = date.split("-").map(Number);
    const onDay = results.filter((r) => {
      const until = daysBetween(today, r.item.dueDate);
      return i === 0 ? until <= 0 : until === i;
    });
    return {
      date,
      n: d,
      weekday: LETTERS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()],
      due: onDay.length,
      late: onDay.filter((r) => r.daysUntil < 0).length,
    };
  });
}
