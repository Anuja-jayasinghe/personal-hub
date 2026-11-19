import { addDays, daysBetween } from "@/lib/dates";
import type { ReminderResult } from "@/features/reminders/engine";
import { badgeLetter } from "@/features/electricity/overview";

/**
 * The pieces of Home that are worth testing (R.4, boards HHomePhone and HHome). Pure: no database,
 * no clock; the page passes everything in.
 */

/** "Morning", "Afternoon" or "Evening" for an hour of the day (0 to 23) in the app time zone. */
export function greetingFor(hour: number): "Morning" | "Afternoon" | "Evening" {
  if (hour >= 4 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 17) return "Afternoon";
  return "Evening";
}

/** When a meter is next due to be read: its last reading plus the interval; today when it has none. */
export function meterCheckDue(lastReadingDate: string | null, checkEveryDays: number, today: string): string {
  return lastReadingDate === null ? today : addDays(lastReadingDate, checkEveryDays);
}

export type TimelineItem = {
  key: string;
  label: string;
  href: string;
  /** "overdue" is past its date (shown at today), "check" a meter read, "due" anything else. */
  tone: "overdue" | "due" | "check";
  /** Days from today to the item's own date; negative when overdue. */
  daysUntil: number;
};

export type TimelineDay = {
  /** Days from today, 0 to `days`. */
  day: number;
  date: string;
  items: TimelineItem[];
};

/**
 * The next `days` days as dated groups for the line on Home: every reminder due within the window,
 * plus each meter's next read. Anything already overdue is gathered at today. Days with nothing on
 * them are left out; the result is sorted by day.
 */
export function nextDays(input: {
  reminders: readonly ReminderResult[];
  checks: readonly { meterName: string; dueDate: string }[];
  today: string;
  days: number;
}): TimelineDay[] {
  const byDay = new Map<number, TimelineItem[]>();
  const add = (day: number, item: TimelineItem) => {
    if (day > input.days) return;
    const d = Math.max(0, day);
    byDay.set(d, [...(byDay.get(d) ?? []), item]);
  };

  for (const c of input.checks) {
    const day = daysBetween(input.today, c.dueDate);
    add(day, { key: `check:${c.meterName}`, label: `Read ${c.meterName}`, href: "/electricity", tone: day < 0 ? "overdue" : "check", daysUntil: day });
  }
  for (const r of input.reminders) {
    add(r.daysUntil, { key: r.item.id, label: r.item.title, href: r.item.href, tone: r.daysUntil < 0 ? "overdue" : "due", daysUntil: r.daysUntil });
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, items]) => ({ day, date: addDays(input.today, day), items }));
}

export type AreaCount = { area: "vehicles" | "bills" | "tasks"; due: number; overdue: number };

/** How many reminders each area has due in the next `days` days (and how many of those are overdue), from where they link to. */
export function dueByArea(reminders: readonly ReminderResult[], days: number): AreaCount[] {
  const areas: AreaCount["area"][] = ["vehicles", "bills", "tasks"];
  return areas.map((area) => {
    const mine = reminders.filter((r) => r.daysUntil <= days && r.item.href.startsWith(`/${area}`));
    return { area, due: mine.length, overdue: mine.filter((r) => r.daysUntil < 0).length };
  });
}

/** What first-day setup still needs: each step is done once its records exist (board HStates). */
export function setupSteps(input: { meters: number; bills: number; readingsSinceBill: number }) {
  return [
    { key: "meters", title: "Add your meters", hint: "a name and the account number", done: input.meters > 0 },
    { key: "bill", title: "Type the last bill", hint: "so the hub knows where the cycle starts", done: input.bills > 0 },
    { key: "reading", title: "Read the meters", hint: "the slab rule lights up", done: input.readingsSinceBill > 0 },
  ] as const;
}

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** A short "when" in the mono label style: "TODAY", "3 DAYS LATE", "FRI 20" within a week, "4 DEC" after. */
export function whenLabel(daysUntil: number, date: string): string {
  if (daysUntil < 0) return daysUntil === -1 ? "1 DAY LATE" : `${-daysUntil} DAYS LATE`;
  if (daysUntil === 0) return "TODAY";
  const [y, m, d] = date.split("-").map(Number);
  if (daysUntil <= 6) return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}`;
  return `${d} ${MONTHS[m - 1]}`;
}

/** "WED 18 NOV" for the line above the greeting. */
export function dayStamp(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
}

/** Which day of the year a date is, and how many days that year has: { day: 323, of: 365 } (S.1). */
export function dayOfYear(date: string): { day: number; of: number } {
  const [y, m, d] = date.split("-").map(Number);
  const day = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return { day, of: leap ? 366 : 365 };
}

/** A few characters for a day on the line: "2 LATE", "READ A·B", "2 DUE", or "READ A +1". */
export function dayLabel(items: readonly TimelineItem[]): string {
  const late = items.filter((i) => i.tone === "overdue").length;
  if (late > 0) return `${late} LATE`;
  const reads = items.filter((i) => i.tone === "check");
  const dues = items.length - reads.length;
  if (dues === 0) return `READ ${reads.map((r) => badgeLetter(r.label.replace(/^Read /, ""))).join("·")}`;
  if (reads.length === 0) return `${dues} DUE`;
  return `${dues} DUE +${reads.length}`;
}

export type PlacedLabel = { day: number; text: string; lane: "up" | "down" } | { day: number; text: null; lane: null };

/**
 * Where each day's label goes on a line `widthPx` wide: above or below, whichever lane is free, and
 * no label at all when both lanes are taken there (the node still shows; the list below has it).
 * Labels are about 6px a character in the 9.5px mono face.
 */
export function placeLabels(days: readonly TimelineDay[], windowDays: number, widthPx: number): PlacedLabel[] {
  const ends = { up: -Infinity, down: -Infinity };
  return days.map((d) => {
    const text = dayLabel(d.items);
    const x = (d.day / windowDays) * widthPx;
    const w = text.length * 6 + 8;
    const start = Math.max(0, Math.min(x - w / 2, widthPx - w));
    for (const lane of ["up", "down"] as const) {
      if (start >= ends[lane]) {
        ends[lane] = start + w;
        return { day: d.day, text, lane };
      }
    }
    return { day: d.day, text: null, lane: null };
  });
}
