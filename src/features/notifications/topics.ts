import { allows, AREAS, type Access, type Area, type Level } from "@/features/people/access";

/**
 * What a person is told about, in words, for their own notifications page (Notifications N.5, DECISIONS
 * C144). Pure. It restates the rules the run applies (`itemsFor` and `eventsFor` in recipients.ts, the
 * steps in steps.ts) from the person's grants, so what the page promises matches what is sent. People
 * get pushes only, never email.
 *
 * The rule, exactly: what the Reminders page would show them.
 *  - Due dates (vehicles, electricity bills, bills, tasks) need the Reminders section AND the item's own
 *    section, both at See. Without Reminders nothing about due dates is sent, because the page a batch
 *    opens would be "not found" for them.
 *  - Electricity events depend only on Electricity readings: slab limits at See, "reading due" at Add.
 */
export type Topic = {
  key: string;
  /** The section (and the level in it) that opens this topic. */
  area: Area;
  level: Level;
  /** True for due dates: the Reminders section at See is needed too. */
  needsReminders: boolean;
  label: string;
  /** What triggers a push, in the app's own plain words. Never an amount or a name. */
  detail: string;
};

export const TOPICS: readonly Topic[] = [
  { key: "readings-due", area: "electricity_readings", level: "add", needsReminders: false, label: "Meter readings", detail: "A reading is overdue, so you can add it" },
  { key: "slab", area: "electricity_readings", level: "see", needsReminders: false, label: "Slab limit", detail: "A meter close to its limit, or over it" },
  { key: "electricity-bills", area: "electricity_bills", level: "see", needsReminders: true, label: "Electricity bills", detail: "A bill due tomorrow, or just overdue" },
  { key: "bills", area: "bills", level: "see", needsReminders: true, label: "Bills and subscriptions", detail: "One due tomorrow, or just overdue" },
  { key: "vehicles", area: "vehicles", level: "see", needsReminders: true, label: "Vehicles", detail: "A renewal ending tomorrow or just ended, a service due today" },
  { key: "tasks", area: "tasks_notes", level: "see", needsReminders: true, label: "Tasks", detail: "A task due today" },
];

/** The topics this access reaches, in the order above. Owners reach all of them. */
export function topicsFor(access: Access): Topic[] {
  return TOPICS.filter((t) => allows(access, t.area, t.level) && (!t.needsReminders || allows(access, "reminders", "see")));
}

/**
 * Topics whose own section the person has but which stay silent because they lack the Reminders
 * section, so the page can say what to ask the owner for.
 */
export function topicsNeedingReminders(access: Access): Topic[] {
  if (allows(access, "reminders", "see")) return [];
  return TOPICS.filter((t) => t.needsReminders && allows(access, t.area, t.level));
}

/** The grants a topic depends on, in words: "Vehicles + Reminders", "Electricity readings at Add". */
export function topicNeeds(t: Topic): string {
  const label = AREAS.find((a) => a.key === t.area)?.label ?? t.area;
  const own = t.level === "see" ? label : `${label} at ${t.level === "add" ? "Add" : "Edit"}`;
  return t.needsReminders ? `${own} + Reminders` : own;
}
