import "server-only";
import { connection } from "next/server";
import { appConfig, isModuleEnabled } from "@/config/app.config";
import { listAllBills, listAllReadings, listLiveSwitches, listMeters } from "@/features/electricity/queries";
import { electricitySnapshot } from "@/features/electricity/snapshot";
import {
  areaGlances,
  daysWords,
  electricityNote,
  homeBrief,
  meterCheckDue,
  nextDays,
  needsNow,
  setupSteps,
  type NeedRow,
} from "@/features/home/home";
import { allows, navItemVisible } from "@/features/people/access";
import { getReminders } from "@/features/reminders/load";
import { getRules } from "@/features/settings/queries";
import { getAccess, getFirstName } from "@/lib/auth";
import { daysBetween } from "@/lib/dates";
import { hourInAppTz } from "@/lib/format";

/** How far ahead Home looks (the line and the glances). */
export const WINDOW_DAYS = 30;

/**
 * Everything the Home page shows, read once at request time (issue #218, C157). The same reads as before the
 * redesign (the reminders, the meters, readings, bills and live switches, the person's first name and the rules);
 * no new query. Only what this person may see (S.8, C114): the reminders are already filtered by section, the
 * electricity reads are skipped without access, and each area's glance is dropped when its section is hidden.
 * Signed-out visitors and people waiting for approval read the demo through `readDb()` inside these queries.
 */
export async function loadHome() {
  await connection();
  const access = (await getAccess()) ?? { owner: false as const, grants: {} };
  const electricityOn = isModuleEnabled("electricity") && allows(access, "electricity_readings", "see");
  const canRead = allows(access, "electricity_readings", "add");
  const [meters, readings, bills, switches, reminders, firstName, rules] = await Promise.all([
    electricityOn ? listMeters(false) : Promise.resolve([]),
    electricityOn ? listAllReadings() : Promise.resolve([]),
    electricityOn ? listAllBills() : Promise.resolve([]),
    electricityOn ? listLiveSwitches() : Promise.resolve([]),
    getReminders(),
    getFirstName(),
    getRules(),
  ]);
  const { today, results } = reminders;
  const snap = electricitySnapshot({ meters, readings, bills, switches, rules, today });
  const { checkEveryDays } = rules;

  // First day: until every meter has a bill and a reading after it, Home shows the setup steps.
  const steps = setupSteps({
    meters: meters.length,
    bills: meters.filter((m) => snap.data.get(m.id)!.last).length === meters.length && meters.length > 0 ? 1 : 0,
    readingsSinceBill: meters.length > 0 && meters.every((m) => snap.data.get(m.id)!.usage.state === "ok") ? 1 : 0,
  });
  // The first-day steps open Settings, which is the owner's only (S.8).
  const settingUp = electricityOn && access.owner && steps.some((s) => !s.done);

  const checks = meters.map((m) => ({ meterName: m.name, dueDate: meterCheckDue(snap.data.get(m.id)!.readingRows[0]?.date ?? null, checkEveryDays, today) }));
  const days = nextDays({ reminders: results, checks, today, days: WINDOW_DAYS });
  const needs: NeedRow[] = needsNow({ reminders: results, checks, checkEveryDays, today });

  const nameOf = (id: string) => meters.find((m) => m.id === id)?.name ?? "Meter";
  const note = meters.length > 0 && !settingUp ? electricityNote(snap.limits.meters, nameOf) : null;
  const ahead = [
    ...results.filter((r) => r.daysUntil > 7).map((r) => ({ label: r.item.title, daysUntil: r.daysUntil })),
    ...checks.map((c) => ({ label: `Read ${c.meterName}`, daysUntil: daysBetween(today, c.dueDate) })).filter((c) => c.daysUntil > 0),
  ];
  const brief = homeBrief({ needs, ahead, electricity: note, windowDays: WINDOW_DAYS, settingUp });

  // Only areas that are switched on and that this person may see.
  const areaOn = (area: "vehicles" | "bills" | "tasks") => (area === "tasks" ? appConfig.sharedPages.some((p) => p.key === "tasks") : isModuleEnabled(area));
  const areas = areaGlances(results, WINDOW_DAYS).filter((g) => areaOn(g.area) && navItemVisible(access, g.area));

  const entries = meters.map((m, i) => {
    const newest = snap.data.get(m.id)?.readingRows[0];
    return { id: m.id, name: m.name, toneIndex: i, lastValue: newest?.value ?? null, lastDate: newest?.date ?? null };
  });

  return {
    today,
    hour: hourInAppTz(),
    firstName,
    canRead,
    electricityOn,
    meters,
    snap,
    entries,
    steps,
    settingUp,
    days,
    needs,
    brief,
    areas,
    checkEveryDays,
    failedSources: reminders.failedSources,
    /** For the line under the greeting when something is coming but nothing needs the person yet. */
    ahead: ahead.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 1).map((a) => ({ ...a, words: daysWords(a.daysUntil) })),
  };
}

export type HomeData = Awaited<ReturnType<typeof loadHome>>;
