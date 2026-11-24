import type { OwnerType } from "@/lib/owners";

/**
 * Who may do what (S.8, DECISIONS C114). Pure.
 *
 * The owners (ALLOWED_EMAILS) may do everything, including the owner-only parts: meters and the slab
 * rules, Settings, Admin and the downloads. Anyone else gets a level per section: Hidden (no grant),
 * See, Add (see and add) or Edit (see, add, change and delete).
 */

export const AREAS = [
  { key: "electricity_readings", label: "Electricity readings", hint: "the meters, their readings and the usage" },
  { key: "electricity_bills", label: "Electricity bills", hint: "amounts, due dates, paid or not" },
  { key: "bills", label: "Bills & subscriptions", hint: "everything else that is paid again and again" },
  { key: "vehicles", label: "Vehicles", hint: "the vehicles, renewals, services and mileage" },
  { key: "vehicle_documents", label: "Vehicle documents", hint: "licences, insurance papers and other files" },
  { key: "reminders", label: "Reminders", hint: "what is due soon, across the parts they can see" },
  { key: "tasks_notes", label: "Tasks & notes", hint: "to-dos and notes" },
] as const;

export type Area = (typeof AREAS)[number]["key"];
export type Level = "see" | "add" | "edit";
export const LEVELS: readonly Level[] = ["see", "add", "edit"];

export type Access = { owner: true } | { owner: false; grants: Partial<Record<Area, Level>> };

const RANK: Record<Level, number> = { see: 1, add: 2, edit: 3 };

export function isArea(value: string): value is Area {
  return AREAS.some((a) => a.key === value);
}

export function isLevel(value: string): value is Level {
  return value === "see" || value === "add" || value === "edit";
}

/** True when `access` reaches at least `level` in `area`. Owners always do. */
export function allows(access: Access, area: Area, level: Level): boolean {
  if (access.owner) return true;
  const granted = access.grants[area];
  return granted !== undefined && RANK[granted] >= RANK[level];
}

/** A section, or "owner" for what only the owners may hear about (a sign-up request, N.4). */
export type SourceArea = Area | "owner";

/** True when `access` may see what a reminder source or event source of this area brings. */
export function allowsSourceArea(access: Access, area: SourceArea): boolean {
  return area === "owner" ? access.owner : allows(access, area, "see");
}

/** The sections a person can at least see, in display order. */
export function visibleAreas(access: Access): Area[] {
  return AREAS.map((a) => a.key).filter((key) => allows(access, key, "see"));
}

/** Which section a shared record (task, note, file) belongs to, from what it is attached to. */
export function areaOfOwner(ownerType: OwnerType | null): Area {
  switch (ownerType) {
    case "vehicle":
    case "vehicle_renewal":
      return "vehicles";
    case "meter":
      return "electricity_readings";
    case "bill":
    case "subscription":
    case "bill_item":
    case "bill_payment":
      return "bills";
    default:
      return "tasks_notes";
  }
}

/**
 * Which section a stored file belongs to (S.8, C114): a vehicle's cover photo is part of Vehicles; its
 * other files and a renewal's papers are Vehicle documents; anything else follows what it is attached to.
 * Seeing, adding and deleting a file all use this, so the three can never disagree.
 */
export function areaOfFile(ownerType: OwnerType | null, isCover = false): Area {
  if (ownerType === "vehicle_renewal") return "vehicle_documents";
  if (ownerType === "vehicle") return isCover ? "vehicles" : "vehicle_documents";
  return areaOfOwner(ownerType);
}

/** Grants as a person's access, ignoring anything not a known section or level. */
export function accessFromGrants(rows: readonly { area: string; level: string }[]): Access {
  const grants: Partial<Record<Area, Level>> = {};
  for (const r of rows) if (isArea(r.area) && isLevel(r.level)) grants[r.area] = r.level;
  return { owner: false, grants };
}

/** What a nav link needs (S.8): the rail and the phone bar only show the parts a person can see. */
export const NAV_AREAS: Record<string, readonly Area[]> = {
  electricity: ["electricity_readings"],
  bills: ["bills", "electricity_bills"],
  vehicles: ["vehicles"],
  reminders: ["reminders"],
  tasks: ["tasks_notes"],
};

/** True when a nav item (by key) should show; Home and More always do, Settings only for owners. */
export function navItemVisible(access: Access, key: string): boolean {
  if (key === "home" || key === "more") return true;
  if (key === "settings") return access.owner;
  const areas = NAV_AREAS[key];
  return !areas || areas.some((a) => allows(access, a, "see"));
}

/** A task or note shows when the person may see Tasks & notes and, when it is attached, that record's section (S.8). */
export function sharedVisible(access: Access, ownerType: OwnerType | string | null, level: Level = "see"): boolean {
  if (!allows(access, "tasks_notes", level)) return false;
  if (!ownerType) return true;
  return allows(access, areaOfOwner(ownerType as OwnerType), "see");
}
