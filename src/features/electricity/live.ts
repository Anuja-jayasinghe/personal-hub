import { daysBetween, isValidDate } from "@/lib/dates";

/**
 * Which meter carries the house (issue #69, DECISIONS C102). Pure: the page passes in the switch rows
 * and the active meters' ids.
 */

export type LiveSwitch = { id: string; meterId: string; switchedOn: string; createdAt: Date };
export type LiveMeter = { meterId: string; since: string; switchId: string };

/**
 * The live meter: the newest switch (by day, then by when it was entered) to a meter that is still
 * active. Switches to archived or deleted meters are skipped, so archiving the live meter leaves the
 * house "not set" rather than pointing at a meter you cannot see. Null when nothing is set.
 */
export function currentLive(switches: readonly LiveSwitch[], activeIds: readonly string[]): LiveMeter | null {
  let best: LiveSwitch | null = null;
  for (const s of switches) {
    if (!activeIds.includes(s.meterId)) continue;
    if (!best || s.switchedOn > best.switchedOn || (s.switchedOn === best.switchedOn && s.createdAt > best.createdAt)) best = s;
  }
  return best ? { meterId: best.meterId, since: best.switchedOn, switchId: best.id } : null;
}

/** Why a switch cannot be saved, or null when it can. A switch may be dated today or earlier, not before the current one. */
export function switchProblem(input: { meterId: string; date: string; today: string; live: LiveMeter | null; activeIds: readonly string[] }): string | null {
  const { meterId, date, today, live, activeIds } = input;
  if (!activeIds.includes(meterId)) return "That meter is not one of your active meters.";
  if (!isValidDate(date)) return "Pick the day you switched.";
  if (date > today) return "The switch day cannot be in the future.";
  if (live?.meterId === meterId) return "The house is already on that meter.";
  if (live && date < live.since) return "That day is before the last switch. Pick a later day.";
  return null;
}

/** "since today", "since yesterday", "for 4 days". */
export function liveForText(since: string, today: string): string {
  const days = daysBetween(since, today);
  if (days <= 0) return "since today";
  if (days === 1) return "since yesterday";
  return `for ${days} days`;
}
