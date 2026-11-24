import { AREAS, isArea, isLevel, type Area, type Level } from "./access";

/**
 * What a set of grants lets a person do, in plain words (invitation email, the Invite form). Pure.
 * Grouped by the most they can do, most first: `["See and add Vehicles", "See Bills & subscriptions"]`.
 * Levels grow (see < add < edit), so "add" already means "see and add".
 */
const WORDS: Record<Level, string> = { edit: "See, add and edit", add: "See and add", see: "See" };
const ORDER: readonly Level[] = ["edit", "add", "see"];

const andList = (items: readonly string[]) => (items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

export function summariseAccess(grants: Partial<Record<Area, Level>>): string[] {
  const lines: string[] = [];
  for (const level of ORDER) {
    const labels = AREAS.filter((a) => grants[a.key] === level).map((a) => a.label);
    if (labels.length > 0) lines.push(`${WORDS[level]} ${andList(labels)}`);
  }
  return lines;
}

/** Grants from loose input, ignoring anything that is not a real section or level. */
export function cleanGrants(input: Record<string, unknown>): Partial<Record<Area, Level>> {
  const grants: Partial<Record<Area, Level>> = {};
  for (const [area, level] of Object.entries(input)) {
    if (isArea(area) && typeof level === "string" && isLevel(level)) grants[area] = level;
  }
  return grants;
}
