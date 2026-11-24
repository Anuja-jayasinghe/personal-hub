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

/** What first-day setup still needs: each step is done once its records exist (board HStates). */
export function setupSteps(input: { meters: number; bills: number; readingsSinceBill: number }) {
  return [
    // Each step opens the one place where that thing is done (S.2a, C106).
    { key: "meters", title: "Add your meters", hint: "a name and the account number", done: input.meters > 0, href: "/settings/meters" },
    { key: "bill", title: "Type the last bill", hint: "so the hub knows where the cycle starts", done: input.bills > 0, href: "/bills#electricity" },
    { key: "reading", title: "Read the meters", hint: "the slab rule lights up", done: input.readingsSinceBill > 0, href: "/electricity" },
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

// ---- The redesigned Home (issue #218, C157): greeting, what needs you, a glance at each area ----

/** "Good morning, Anuja." or, without a name, "Good evening." (the name is the signed-in person's own first name, never a guess). */
export function greetingLine(hour: number, firstName: string | null): string {
  return `Good ${greetingFor(hour).toLowerCase()}${firstName ? `, ${firstName}` : ""}.`;
}

/** "tomorrow", "in 12 days", "today", "3 days ago" for a count of days from today. */
export function daysWords(daysUntil: number): string {
  if (daysUntil === 0) return "today";
  if (daysUntil === 1) return "tomorrow";
  if (daysUntil === -1) return "yesterday";
  return daysUntil < 0 ? `${-daysUntil} days ago` : `in ${daysUntil} days`;
}

/** Items due within this many days (or late) are "needs you"; the rest are "coming up". The reminder engine's own "soon" window. */
export const NEEDS_WITHIN_DAYS = 7;

export type NeedRow = TimelineItem & { date: string; sub: string };

/**
 * What needs the person now, most urgent first: everything late, everything due within a week (what the
 * Reminders page calls overdue, today and soon), and a meter read once it is due or late. Later dates are
 * not here (they are on the 30-day line and in each area's glance). Nothing is dropped: it is the same
 * reminders and meter reads that `nextDays` works from.
 */
export function needsNow(input: {
  reminders: readonly ReminderResult[];
  checks: readonly { meterName: string; dueDate: string }[];
  checkEveryDays: number;
  today: string;
}): NeedRow[] {
  const rows: NeedRow[] = [];
  for (const c of input.checks) {
    const day = daysBetween(input.today, c.dueDate);
    if (day > 0) continue;
    rows.push({ key: `check:${c.meterName}`, label: `Read ${c.meterName}`, href: "/electricity", tone: day < 0 ? "overdue" : "check", daysUntil: day, date: c.dueDate, sub: `every ${input.checkEveryDays} days` });
  }
  for (const r of input.reminders) {
    if (r.daysUntil > NEEDS_WITHIN_DAYS) continue;
    rows.push({ key: r.item.id, label: r.item.title, href: r.item.href, tone: r.daysUntil < 0 ? "overdue" : "due", daysUntil: r.daysUntil, date: r.item.dueDate, sub: r.item.kind });
  }
  return rows.sort((a, b) => a.daysUntil - b.daysUntil || a.label.localeCompare(b.label));
}

export type AreaGlance = {
  area: "vehicles" | "bills" | "tasks";
  /** Reminders due in the window (late ones included). */
  due: number;
  overdue: number;
  /** The most urgent of them (a late one first), or null with nothing due. */
  soonest: { title: string; href: string; kind: string; daysUntil: number; date: string } | null;
  /** How many distinct records (vehicles) have something due, from `ownerId`. */
  records: number;
};

/** For each area: how much is due in the window, how much is late, and the soonest item with where it opens. */
export function areaGlances(reminders: readonly ReminderResult[], days: number): AreaGlance[] {
  const areas: AreaGlance["area"][] = ["vehicles", "bills", "tasks"];
  return areas.map((area) => {
    const mine = reminders.filter((r) => r.daysUntil <= days && r.item.href.startsWith(`/${area}`)).sort((a, b) => a.daysUntil - b.daysUntil);
    const first = mine[0];
    return {
      area,
      due: mine.length,
      overdue: mine.filter((r) => r.daysUntil < 0).length,
      soonest: first ? { title: first.item.title, href: first.item.href, kind: first.item.kind, daysUntil: first.daysUntil, date: first.item.dueDate } : null,
      records: new Set(mine.map((r) => r.item.ownerId ?? r.item.id)).size,
    };
  });
}

export type ElectricityNote = { tone: "overdue" | "soon"; text: string };

/** One line on the slab rule for the brief: the meter over its limit (red) or near it (amber), or null when all is well. */
export function electricityNote(
  limits: readonly { id: string; state: "ok" | "near" | "over"; left: number; limit: number }[],
  nameOf: (id: string) => string,
): ElectricityNote | null {
  const over = limits.find((m) => m.state === "over");
  if (over) return { tone: "overdue", text: `${nameOf(over.id)} is ${Math.round(-over.left)} over ${over.limit}` };
  const near = limits.find((m) => m.state === "near");
  if (near) return { tone: "soon", text: `${nameOf(near.id)} is ${Math.round(near.left)} units from ${near.limit}` };
  return null;
}

export type HomeBrief = {
  tone: "overdue" | "soon" | "ok";
  headline: string;
  /** The detail behind the headline, each in its own state colour. Empty when all is well. */
  chips: { text: string; tone: "overdue" | "soon" }[];
  /** With nothing needing the person: what comes next ("Next up: Revenue license, in 12 days."), or that nothing is coming. */
  nextUp: string | null;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The one line under the greeting: how many things need the person, split into late, due this week, meter
 * reads and the slab rule, or a calm "all clear" with what comes next. The tone is the worst of them.
 */
export function homeBrief(input: {
  needs: readonly NeedRow[];
  ahead: readonly { label: string; daysUntil: number }[];
  electricity: ElectricityNote | null;
  windowDays: number;
  /** The owner is still on the first-day steps: welcome them instead of saying "All clear". */
  settingUp?: boolean;
}): HomeBrief {
  const late = input.needs.filter((n) => n.daysUntil < 0).length;
  const reads = input.needs.filter((n) => n.daysUntil >= 0 && n.tone === "check").length;
  const week = input.needs.length - late - reads;
  const total = input.needs.length + (input.electricity ? 1 : 0);

  if (total === 0 && input.settingUp) return { tone: "ok", headline: "Welcome to your hub.", chips: [], nextUp: null };
  if (total === 0) {
    const next = [...input.ahead].sort((a, b) => a.daysUntil - b.daysUntil)[0];
    return {
      tone: "ok",
      headline: "All clear.",
      chips: [],
      nextUp: next ? `Next up: ${next.label}, ${daysWords(next.daysUntil)}.` : `Nothing is due in the next ${input.windowDays} days.`,
    };
  }
  const chips: HomeBrief["chips"] = [];
  if (late > 0) chips.push({ text: `${late} late`, tone: "overdue" });
  if (week > 0) chips.push({ text: `${plural(week, "item", "items")} due this week`, tone: "soon" });
  if (reads > 0) chips.push({ text: plural(reads, "meter read", "meter reads") + " due", tone: "soon" });
  if (input.electricity) chips.push(input.electricity);
  const tone = late > 0 || input.electricity?.tone === "overdue" ? "overdue" : "soon";
  return { tone, headline: `${plural(total, "thing needs", "things need")} you.`, chips, nextUp: null };
}
