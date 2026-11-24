import type { Area, Level } from "./access";

/**
 * The quick choices in the Invite form (issue #236): small data, so a test can check that every preset
 * only names real sections and levels. "Customise access" sets each section by hand. Pure.
 */
export type InvitePreset = { id: string; label: string; hint: string; grants: Partial<Record<Area, Level>> };

export const INVITE_PRESETS: readonly InvitePreset[] = [
  {
    id: "see-only",
    label: "See only",
    hint: "Look at electricity, bills, vehicles and reminders. Change nothing.",
    grants: { electricity_readings: "see", electricity_bills: "see", bills: "see", vehicles: "see", reminders: "see" },
  },
  {
    id: "see-add",
    label: "See and add",
    hint: "The same, and add readings, vehicle records, tasks and notes.",
    grants: { electricity_readings: "add", electricity_bills: "see", bills: "see", vehicles: "add", vehicle_documents: "see", reminders: "see", tasks_notes: "add" },
  },
  {
    id: "no-money",
    label: "Everything except money",
    hint: "Full access to every section, but no bills and no electricity bills.",
    grants: { electricity_readings: "edit", vehicles: "edit", vehicle_documents: "edit", reminders: "edit", tasks_notes: "edit" },
  },
];

export const DEFAULT_PRESET = INVITE_PRESETS[0];

/** The preset whose grants equal `grants` exactly, or null for a custom choice. */
export function presetFor(grants: Partial<Record<Area, Level>>): InvitePreset | null {
  const keys = Object.keys(grants) as Area[];
  return INVITE_PRESETS.find((p) => Object.keys(p.grants).length === keys.length && keys.every((k) => p.grants[k] === grants[k])) ?? null;
}
