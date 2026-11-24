import { allows, type Access, type Area, type Level } from "@/features/people/access";

/**
 * What a person is told about, in words, for their own notifications page (Notifications N.5, DECISIONS
 * C144). Pure. It restates the rules the run applies (`SOURCE_AREA`, `EVENT_LEVEL`, the steps in
 * steps.ts) from the person's grants, so what the page promises matches what is sent: a test checks that
 * every section a shared person can be told about is listed here. People get pushes only, never email.
 */
export type Topic = {
  key: string;
  /** The section (and the level in it) that opens this topic. */
  area: Area;
  level: Level;
  label: string;
  /** What triggers a push, in the app's own plain words. Never an amount or a name. */
  detail: string;
};

export const TOPICS: readonly Topic[] = [
  { key: "readings-due", area: "electricity_readings", level: "add", label: "Meter readings", detail: "A reading is overdue, so you can add it" },
  { key: "slab", area: "electricity_readings", level: "see", label: "Slab limit", detail: "A meter close to its limit, or over it" },
  { key: "electricity-bills", area: "electricity_bills", level: "see", label: "Electricity bills", detail: "A bill due tomorrow, or just overdue" },
  { key: "bills", area: "bills", level: "see", label: "Bills and subscriptions", detail: "One due tomorrow, or just overdue" },
  { key: "vehicles", area: "vehicles", level: "see", label: "Vehicles", detail: "A renewal ending tomorrow or just ended, a service due today" },
  { key: "tasks", area: "tasks_notes", level: "see", label: "Tasks", detail: "A task due today" },
];

/** The topics this access reaches, in the order above. Owners reach all of them. */
export function topicsFor(access: Access): Topic[] {
  return TOPICS.filter((t) => allows(access, t.area, t.level));
}
