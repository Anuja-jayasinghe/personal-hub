import type { ReminderItem } from "@/features/reminders/engine";

/**
 * When the hub reaches out, and how (Notifications N.1, DECISIONS C139). One map, so N.4 can add
 * cheques, the slab limit, missed readings and sign-ups by adding an event and a line in `eventOf`.
 *
 * The owner's rules:
 *  - nothing new, nothing sent (no digest, no "all clear", no repeats);
 *  - at most three notices per item, ever: one plan-ahead EMAIL, one act-now PUSH, one PUSH on the
 *    first day overdue; after that the item lives only on the Reminders page;
 *  - one channel per notice (an email and a push never say the same thing);
 *  - one message per day per channel per person (several items are batched).
 * Pure: no database, clock or env.
 */

export type Channel = "email" | "push";
export const CHANNELS: readonly Channel[] = ["email", "push"];

export type StepName = "plan" | "act" | "overdue";

/**
 * plan    — an email `daysBefore` the due date (caught up later inside the window, while more than one day remains)
 * act     — a push `daysBefore` the due date (1 = the day before, 0 = on the day; caught up only while still timely)
 * overdue — a push on the first run after the due date, within OVERDUE_WINDOW_DAYS
 */
export type StepRule =
  | { step: "plan"; channel: "email"; daysBefore: number }
  | { step: "act"; channel: "push"; daysBefore: 0 | 1 }
  | { step: "overdue"; channel: "push" };

export type EventKey = "renewal" | "service" | "electricity-bill" | "bill" | "autopay" | "task";

/**
 * Notices that do not come from a reminder, so never from the steps below (N.3, C140): a test push the
 * owner asked for, and the one email saying an iPhone stopped accepting pushes.
 */
export type SystemKind = "push-test" | "push-gone";
export type NoticeKind = EventKey | SystemKind;

export type EventRule = {
  /** How the event reads in a message: "Insurance ends 23 Dec" / "Electricity bill due 30 Nov". */
  verb: "ends" | "due";
  /** Said once it is past: "Insurance has ended" / "Electricity bill overdue". */
  past: "has ended" | "overdue";
  /** The body of a push when the item has no `who` (a bill's page). */
  place: string;
  steps: readonly StepRule[];
};

/** An overdue push is only sent within this many days after the due date (catch-up). */
export const OVERDUE_WINDOW_DAYS = 7;

export const NOTIFICATION_STEPS: Record<EventKey, EventRule> = {
  /** Revenue license, insurance, emission test. The overdue push only if still current (the source lists only current renewals). */
  renewal: {
    verb: "ends",
    past: "has ended",
    place: "Vehicles",
    steps: [
      { step: "plan", channel: "email", daysBefore: 30 },
      { step: "act", channel: "push", daysBefore: 1 },
      { step: "overdue", channel: "push" },
    ],
  },
  service: {
    verb: "due",
    past: "overdue",
    place: "Vehicles",
    steps: [
      { step: "plan", channel: "email", daysBefore: 14 },
      { step: "act", channel: "push", daysBefore: 0 },
    ],
  },
  /** Unpaid electricity bills (the source drops paid ones, so "if unpaid" holds). */
  "electricity-bill": {
    verb: "due",
    past: "overdue",
    place: "Bills",
    steps: [
      { step: "plan", channel: "email", daysBefore: 7 },
      { step: "act", channel: "push", daysBefore: 1 },
      { step: "overdue", channel: "push" },
    ],
  },
  /** A bill or subscription paid by hand. */
  bill: {
    verb: "due",
    past: "overdue",
    place: "Bills",
    steps: [
      { step: "act", channel: "push", daysBefore: 1 },
      { step: "overdue", channel: "push" },
    ],
  },
  /** The bank pays it: nothing is sent. */
  autopay: { verb: "due", past: "overdue", place: "Bills", steps: [] },
  /** A task's title is free text and is never sent (C139): "Task due today" / "Open Tasks". */
  task: {
    verb: "due",
    past: "overdue",
    place: "Open Tasks",
    steps: [{ step: "act", channel: "push", daysBefore: 0 }],
  },
};

/**
 * Which event a reminder item is, from the prefix of its id (set by the sources in
 * src/features/reminders/sources/*). Unknown items send nothing.
 */
export function eventOf(item: Pick<ReminderItem, "id" | "kind">): EventKey | null {
  const prefix = item.id.slice(0, item.id.indexOf(":"));
  switch (prefix) {
    case "renewal":
      return "renewal";
    case "service":
      return "service";
    case "electricity-bill":
      return "electricity-bill";
    case "bill-item":
      return item.kind === "autopay" ? "autopay" : "bill";
    case "task":
      return "task";
    default:
      return null;
  }
}

/** True when a step may still be sent with `daysUntil` days left (negative once past), catch-up included. */
export function stepIsDue(rule: StepRule, daysUntil: number): boolean {
  switch (rule.step) {
    case "plan":
      // Inside the window and more than one day left; an item that first appears inside the window still gets it.
      return daysUntil <= rule.daysBefore && daysUntil > 1;
    case "act":
      // Only while still timely: the "day before" push may go on the day itself, never later.
      return daysUntil >= 0 && daysUntil <= rule.daysBefore;
    case "overdue":
      return daysUntil < 0 && daysUntil >= -OVERDUE_WINDOW_DAYS;
  }
}

/** The dedupe key of a notice: unique per recipient. A renewed item has a new due date, so a new key. */
export function dedupeKey(itemId: string, step: StepName, dueDate: string): string {
  return `${itemId}:${step}:${dueDate}`;
}
