import type { NoticeEvent, ReminderItem } from "@/features/reminders/engine";

/**
 * When the hub reaches out, and how (Notifications N.1, DECISIONS C139). One map. Since N.4 (C142) it
 * also holds the events that happen NOW and have no due date: a meter near its slab limit or over it, a
 * meter reading overdue, someone waiting for sign-up approval (each one push, see NOW_EVENTS below).
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

export type StepName = "plan" | "act" | "overdue" | "now";

/**
 * plan    — an email `daysBefore` the due date (caught up later inside the window, while more than one day remains)
 * act     — a push `daysBefore` the due date (1 = the day before, 0 = on the day; caught up only while still timely)
 * overdue — a push on the first run after the due date, within OVERDUE_WINDOW_DAYS
 * now     — a push for an event happening now (N.4); the event itself says on which days it may go
 */
export type StepRule =
  | { step: "plan"; channel: "email"; daysBefore: number }
  | { step: "act"; channel: "push"; daysBefore: 0 | 1 }
  | { step: "overdue"; channel: "push" }
  | { step: "now"; channel: "push" };

/** Events that come from a due date (reminder items) and events happening now (`NoticeEvent`s, N.4). */
export type DatedEventKey = "renewal" | "service" | "electricity-bill" | "bill" | "autopay" | "task" | "cheque" | "cheque-stale";
export type NowEventKey = NoticeEvent["event"];
export type EventKey = DatedEventKey | NowEventKey;

/**
 * Notices that do not come from a reminder, so never from the steps below (N.3, C140): a test push the
 * owner asked for, and the one email saying an iPhone stopped accepting pushes.
 */
export type SystemKind = "push-test" | "push-gone";
export type NoticeKind = EventKey | SystemKind;

export type EventRule = {
  /** How the event reads in a message: "Insurance ends 23 Dec" / "Electricity bill due 30 Nov". */
  verb: "ends" | "due" | "to deposit" | "goes stale";
  /** Said once it is past: "Insurance has ended" / "Electricity bill overdue" / "Cheque not deposited yet". */
  past: "has ended" | "overdue" | "not deposited yet" | "has gone stale";
  /** The body of a push when the item has no `who` (a bill's page). */
  place: string;
  steps: readonly StepRule[];
};

/** An overdue push is only sent within this many days after the due date (catch-up). */
export const OVERDUE_WINDOW_DAYS = 7;

/**
 * How many days after it begins an event happening now (a reading overdue, a sign-up request) may
 * still be sent, so a missed run, or a day's push held back, catches up. Slab events are only ever about today.
 */
export const EVENT_WINDOW_DAYS = 7;

const DATED_EVENTS = {
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
  /**
   * A received cheque waiting to be deposited (issue #178, C158), due on its cheque date. Owners only. The
   * words are only "Cheque" (never an amount, a name, a bank or a number). C139's three: an email a week
   * before, a push on the day it can be deposited, a push on the first day it is overdue. Every day after
   * that it stays on the Reminders page and Home, as the rule says.
   */
  cheque: {
    verb: "to deposit",
    past: "not deposited yet",
    place: "Cheques",
    steps: [
      { step: "plan", channel: "email", daysBefore: 7 },
      { step: "act", channel: "push", daysBefore: 0 },
      { step: "overdue", channel: "push" },
    ],
  },
  /** The same cheque going stale, six months after its date: an email a month ahead, a push the day before, a push the day after. */
  "cheque-stale": {
    verb: "goes stale",
    past: "has gone stale",
    place: "Cheques",
    steps: [
      { step: "plan", channel: "email", daysBefore: 30 },
      { step: "act", channel: "push", daysBefore: 1 },
      { step: "overdue", channel: "push" },
    ],
  },
} satisfies Record<DatedEventKey, EventRule>;

/**
 * Events happening now (N.4, C142): one push each, owners only for now, never an email. Each has its
 * own dedupe key (`NoticeEvent.key`), so none can be sent twice:
 *  - slab-near: a meter's usage came within the near margin of its limit (once per cycle per meter);
 *  - slab-over: it crossed the limit (once per cycle per meter);
 *  - reading-due: no new reading for "check every N days" (once per last reading);
 *  - access-request: someone signed in and waits for approval (once per person).
 */
const NOW_EVENTS = {
  "slab-near": { steps: [{ step: "now", channel: "push" }] },
  "slab-over": { steps: [{ step: "now", channel: "push" }] },
  "reading-due": { steps: [{ step: "now", channel: "push" }] },
  "access-request": { steps: [{ step: "now", channel: "push" }] },
} satisfies Record<NowEventKey, { steps: readonly StepRule[] }>;

export const NOTIFICATION_STEPS = { ...DATED_EVENTS, ...NOW_EVENTS };

/** True when `today` is inside the days an event may be sent. */
export function inWindow(event: Pick<NoticeEvent, "from" | "until">, today: string): boolean {
  return event.from <= today && today <= event.until;
}

/**
 * Which event a reminder item is, from the prefix of its id (set by the sources in
 * src/features/reminders/sources/*). Unknown items send nothing.
 */
export function eventOf(item: Pick<ReminderItem, "id" | "kind">): DatedEventKey | null {
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
    case "cheque":
      return "cheque";
    case "cheque-stale":
      return "cheque-stale";
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
    case "now":
      // Events happening now have no due date: their own window decides (`inWindow`).
      return false;
  }
}

/** The dedupe key of a notice: unique per recipient. A renewed item has a new due date, so a new key. */
export function dedupeKey(itemId: string, step: StepName, dueDate: string): string {
  return `${itemId}:${step}:${dueDate}`;
}
