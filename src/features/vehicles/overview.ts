import { computeReminders, type ReminderItem } from "@/features/reminders/engine";
import { allows, type Access } from "@/features/people/access";
import { UUID_RE } from "@/features/shared/validation";
import { daysBetween, dayMonth, todayIn } from "@/lib/dates";
import { formatDate, formatMoney } from "@/lib/format";
import { latestPoint, type OdometerPoint } from "./odometer";
import { daysWords, toneOfDays } from "./papers";
import { currentRenewals } from "./renewal-logic";
import { isOilChangeType, latestPerType, type OilRules } from "./service-logic";

/**
 * The new vehicle Overview (V.2, C149). Pure: plain values in and out, no database, clock or config, so every
 * rule is easy to test. The page loads the rows, works out `today` and the access booleans on the server, and
 * hands the results to dumb components.
 *
 * What lives here: the "Needs you" bar (the reminder engine's own windows, so this page and the Reminders page
 * can never disagree), the at-a-glance cards soonest first, the oil-change km glance (a glance ONLY: nothing
 * reminds by km, C24), the timeline of recent events, and the `?item=` address of a detail sheet.
 */

// ---------------------------------------------------------------------------------------------
// The rows this module reads (as much of each table as it needs)
// ---------------------------------------------------------------------------------------------

export type OverviewRenewal = {
  id: string;
  vehicleId: string;
  type: string;
  provider: string | null;
  startDate: string | null;
  expiryDate: string;
  amount: string | null;
  renewedAt: Date | null;
  createdAt: Date;
};

export type OverviewService = {
  id: string;
  vehicleId: string;
  serviceDate: string;
  serviceType: string;
  garage: string | null;
  odometerKm: number | null;
  cost: string | null;
  nextDueDate: string | null;
  createdAt: Date;
};

export type OverviewReading = { id: string; readingDate: string; km: number; createdAt: Date };

/** The rules the Overview reads (HubRules has all of them). */
export type OverviewRules = OilRules & { leadDays: readonly number[] };

const km = (n: number) => `${n.toLocaleString("en-LK")} km`;

// ---------------------------------------------------------------------------------------------
// ?item= : which record a detail sheet is about
// ---------------------------------------------------------------------------------------------

export type ItemRef = { kind: "renewal" | "service"; id: string };

const ITEM_RE = /^(renewal|service):(.+)$/;

/**
 * The record named by a `?item=renewal:<id>` / `?item=service:<id>` address, or null for anything else
 * (nothing, a list, a malformed value, a word that is not one of the two, an id that is not a uuid). Whether the id belongs
 * to THIS vehicle is decided by `pickItem` against the vehicle's own rows, never here.
 */
export function parseItem(raw: string | readonly string[] | undefined): ItemRef | null {
  if (typeof raw !== "string") return null;
  const m = ITEM_RE.exec(raw);
  if (!m || !UUID_RE.test(m[2])) return null;
  return { kind: m[1] as ItemRef["kind"], id: m[2].toLowerCase() };
}

/** The address value of a record: `renewal:<id>`. */
export const itemParam = (item: ItemRef): string => `${item.kind}:${item.id}`;

/** A vehicle's own address with the sheet of a record open: `/vehicles/cab-1234?item=renewal:<id>`. */
export const itemHref = (basePath: string, item: ItemRef): string => `${basePath}?item=${itemParam(item)}`;

export type PickedItem<R extends { id: string }, S extends { id: string }> = { kind: "renewal"; row: R } | { kind: "service"; row: S };

/**
 * The record an address names, found only among THIS vehicle's own rows. Another vehicle's id, an id of the
 * other kind ("service:" with a renewal's id), a deleted record and anything malformed all give null, so the
 * page shows no sheet and says nothing about whether such a record exists.
 */
export function pickItem<R extends { id: string }, S extends { id: string }>(raw: string | readonly string[] | undefined, renewals: readonly R[], services: readonly S[]): PickedItem<R, S> | null {
  const ref = parseItem(raw);
  if (!ref) return null;
  if (ref.kind === "renewal") {
    const row = renewals.find((r) => r.id.toLowerCase() === ref.id);
    return row ? { kind: "renewal", row } : null;
  }
  const row = services.find((s) => s.id.toLowerCase() === ref.id);
  return row ? { kind: "service", row } : null;
}

// ---------------------------------------------------------------------------------------------
// Who may do what in the sheets
// ---------------------------------------------------------------------------------------------

/**
 * What this person may do in a detail sheet, as plain booleans for the browser (the actions decide again).
 * Seeing the page needs See in Vehicles. Edit, Delete and Renew need Edit in Vehicles. The files follow Vehicle
 * documents, never Vehicles (C114): seeing a service in Vehicles does not open an invoice or a scan.
 */
export type SheetAccess = {
  /** Edit and delete the record, and Renew. */
  canEdit: boolean;
  /** See the file tile, its name and its size at all. */
  canSeeFiles: boolean;
  /** "Add the scan" / "Add the invoice". */
  canAddFile: boolean;
  /** Replace or delete a file. */
  canEditFiles: boolean;
};

export function sheetAccess(access: Access): SheetAccess {
  return {
    canEdit: allows(access, "vehicles", "edit"),
    canSeeFiles: allows(access, "vehicle_documents", "see"),
    canAddFile: allows(access, "vehicle_documents", "add"),
    canEditFiles: allows(access, "vehicle_documents", "edit"),
  };
}

// ---------------------------------------------------------------------------------------------
// The oil-change marker and the km glance
// ---------------------------------------------------------------------------------------------

/**
 * Km driven since a service, for the glance beside the oil-change date (C24: a glance ONLY, nothing reminds
 * by km). `fitting` is the odometer history that fits (`unfitKeys` already left out what doesn't). The base is
 * the service's own odometer, which must be in that history; the end is the newest value in it. Null when the
 * service has no odometer (or its value doesn't fit), or when nothing newer was read: the km part is then
 * simply not shown. A reading from before the service never counts, because the newest value is never older
 * than the service's own.
 */
export function kmDrivenSince(fitting: readonly OdometerPoint[], service: { id: string }): number | null {
  const own = fitting.find((p) => p.source === "service" && p.id === service.id);
  if (!own) return null;
  const latest = latestPoint(fitting);
  if (!latest || (latest.source === own.source && latest.id === own.id)) return null;
  return Math.max(0, latest.km - own.km);
}

export type OilState =
  /** No service of an oil-change type at all. */
  | { has: false }
  | {
      has: true;
      /** The newest oil-change service (the one cycle, V.1b): it decides the marker. */
      serviceId: string;
      serviceType: string;
      serviceDate: string;
      /** Its stored next-due date (the marker, V.1a); null when "remind me" was off. */
      markerDate: string | null;
      /** Days from today to the marker (negative when late); null with no marker. */
      days: number | null;
      /** How long the marker was set for, for how full its ring is. */
      span: number;
      /** Km driven since, of the rule's km; null when it cannot be known. */
      km: { driven: number; of: number } | null;
    };

/** A year of oil-change months is about this many days, when there is no marker to measure against. */
const DEFAULT_OIL_SPAN = 183;

export function oilState(services: readonly OverviewService[], rules: OilRules, today: string, fitting: readonly OdometerPoint[]): OilState {
  const newest = latestPerType(services, rules.oilChangeTypes).find((s) => isOilChangeType(s.serviceType, rules));
  if (!newest) return { has: false };
  const driven = kmDrivenSince(fitting, newest);
  return {
    has: true,
    serviceId: newest.id,
    serviceType: newest.serviceType,
    serviceDate: newest.serviceDate,
    markerDate: newest.nextDueDate,
    days: newest.nextDueDate ? daysBetween(today, newest.nextDueDate) : null,
    span: newest.nextDueDate ? Math.max(1, daysBetween(newest.serviceDate, newest.nextDueDate)) : DEFAULT_OIL_SPAN,
    km: driven === null ? null : { driven, of: rules.oilChangeKm },
  };
}

/** "1,820 of 2,500 km". */
export const kmGlanceWords = (k: { driven: number; of: number }): string => `${k.driven.toLocaleString("en-LK")} of ${km(k.of)}`;

// ---------------------------------------------------------------------------------------------
// Needs you
// ---------------------------------------------------------------------------------------------

export type Need = {
  /** Unique: `renewal:<id>` or `service:<id>`. */
  key: string;
  item: ItemRef;
  /** What is due. */
  what: "oil" | "renewal" | "service";
  title: string;
  detail: string;
  /** Days to the date; negative when late. */
  days: number;
  /** Red inside 7 days or late, amber otherwise. */
  tone: "soon" | "overdue";
};

export type NextUp = { words: string; days: number };

export type NeedsYou = {
  /** Most urgent first: late, then soonest. Empty means all clear. */
  needs: Need[];
  /** With nothing needing attention: the soonest thing coming up, or null when nothing is coming. */
  next: NextUp | null;
};

/** "20 days left", "Due today", "3 days late". */
export function dueWords(days: number): string {
  if (days === 0) return "Due today";
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} late`;
  return `${days} day${days === 1 ? "" : "s"} left`;
}

type Candidate = {
  reminder: ReminderItem;
  item: ItemRef;
  what: Need["what"];
  /** "the emission test", for "Next up: ...". */
  upNext: string;
  title: (days: number, due: string) => string;
  detail: (days: number) => string;
};

/**
 * What needs attention on this vehicle, with the same rules as the Reminders page: only a renewal that is the
 * current one of its type (not renewed, C46) and the service whose next-due date is the newest of its cycle (the
 * oil-change types as one cycle, V.1b) count, and an item shows once it is inside its own window (the type's lead
 * days, else the rules' largest). Late items stay until they are dealt with. A type with no record at all never
 * appears here: nothing is due that was never set up. When nothing needs attention, `next` is the soonest date
 * still coming.
 */
export function needsYou(input: {
  today: string;
  renewals: readonly OverviewRenewal[];
  services: readonly OverviewService[];
  rules: OverviewRules;
  /** A renewal type's own lead days, when it warns earlier than the rest (app.config.ts). */
  renewalLeadDays: ReadonlyMap<string, readonly number[] | undefined>;
  oil: OilState;
}): NeedsYou {
  const { today, rules, oil } = input;
  const candidates: Candidate[] = [];

  for (const r of currentRenewals(input.renewals)) {
    candidates.push({
      reminder: { id: `renewal:${r.id}`, title: r.type, dueDate: r.expiryDate, href: "", kind: "renewal", leadDays: input.renewalLeadDays.get(r.type) },
      item: { kind: "renewal", id: r.id },
      what: "renewal",
      upNext: `the ${r.type.toLowerCase()}`,
      title: (days, due) => (days < 0 ? `${r.type} ended ${dayMonth(due)}` : days === 0 ? `${r.type} ends today` : `${r.type} ends ${dayMonth(due)}`),
      detail: (days) => daysWords(days),
    });
  }

  for (const s of latestPerType(input.services, rules.oilChangeTypes)) {
    if (!s.nextDueDate) continue;
    const isOil = isOilChangeType(s.serviceType, rules);
    const kmPart = isOil ? (oil.has && oil.km ? `, or ${km(oil.km.of)} (${oil.km.driven.toLocaleString("en-LK")} driven)` : `, or ${km(rules.oilChangeKm)}`) : "";
    candidates.push({
      reminder: { id: `service:${s.id}`, title: s.serviceType, dueDate: s.nextDueDate, href: "", kind: "service" },
      item: { kind: "service", id: s.id },
      what: isOil ? "oil" : "service",
      upNext: isOil ? "the next oil change" : `the next ${s.serviceType.toLowerCase()}`,
      title: (days, due) => (isOil ? (days < 0 ? `Oil change was due ${dayMonth(due)}` : days === 0 ? "Oil change is due today" : `Oil change by ${dayMonth(due)}`) : days < 0 ? `${s.serviceType} was due ${dayMonth(due)}` : `${s.serviceType} due ${dayMonth(due)}`),
      detail: (days) => `${dueWords(days)}${kmPart}`,
    });
  }

  const byId = new Map(candidates.map((c) => [c.reminder.id, c]));
  const inWindow = computeReminders(candidates.map((c) => c.reminder), today, rules.leadDays);
  const needs = inWindow.map((r): Need => {
    const c = byId.get(r.item.id)!;
    return {
      key: r.item.id,
      item: c.item,
      what: c.what,
      title: c.title(r.daysUntil, r.item.dueDate),
      detail: c.detail(r.daysUntil),
      days: r.daysUntil,
      tone: r.daysUntil <= 7 ? "overdue" : "soon",
    };
  });
  if (needs.length > 0) return { needs, next: null };

  // All clear: the soonest date still ahead (everything left is outside its window, so none is late or due today).
  const ahead = candidates
    .map((c) => ({ words: c.upNext, days: daysBetween(today, c.reminder.dueDate) }))
    .filter((c) => c.days >= 0)
    .sort((a, b) => a.days - b.days || a.words.localeCompare(b.words));
  return { needs: [], next: ahead[0] ?? null };
}

/** "Next up: the emission test, in 292 days." */
export function nextUpWords(next: NextUp): string {
  return `Next up: ${next.words}, in ${next.days} day${next.days === 1 ? "" : "s"}.`;
}

// ---------------------------------------------------------------------------------------------
// The at-a-glance cards
// ---------------------------------------------------------------------------------------------

export type GlanceCard = {
  key: string;
  /** What a click opens; null for the "nothing recorded" card, which only says so. */
  item: ItemRef | null;
  title: string;
  /** The small mono line: "By 14 Dec 2026", "To 16 Apr 2027", "Ended 12 Nov 2026". Null when there is no date. */
  dateLine: string | null;
  /** A quiet line under it: the provider, or why there is no ring. */
  sub: string | null;
  /** Days to the date (negative when late); null with no date, which draws no ring. */
  days: number | null;
  /** How full a full ring is. */
  span: number;
  tone: "ok" | "soon" | "overdue" | null;
  /** The oil card only: km driven since, of the rule's km, and how full its bar is (0 to 1). */
  km: { driven: number; of: number; share: number } | null;
  /** The accessible name: "Revenue license, 268 days left". */
  label: string;
};

/** The days a card's ring is read out as: "268 days left", "3 days late", "ends today". */
function ringWords(days: number): string {
  if (days === 0) return "ends today";
  return days < 0 ? `${-days} day${days === -1 ? "" : "s"} late` : `${days} day${days === 1 ? "" : "s"} left`;
}

/** Days a renewal usually runs, for how full its ring is: from its start date when known, otherwise a year. */
function spanOf(startDate: string | null, expiryDate: string): number {
  return startDate ? Math.max(1, daysBetween(startDate, expiryDate)) : 365;
}

/**
 * The cards, soonest first (late ones first of all): the oil-change marker and every CURRENT renewal (one per
 * type, never a renewed one). A type with no record shows no card. The oil card is always there once the
 * vehicle has any record: with no oil-change service it says so, with a service but no marker (remind me off) it shows
 * the service date and no ring. Those two have no date, so they come last.
 */
export function glanceCards(input: { today: string; renewals: readonly OverviewRenewal[]; oil: OilState; hasAnyRecord: boolean }): GlanceCard[] {
  const { today, oil } = input;
  const cards: GlanceCard[] = [];

  for (const r of currentRenewals(input.renewals)) {
    const days = daysBetween(today, r.expiryDate);
    cards.push({
      key: `renewal:${r.id}`,
      item: { kind: "renewal", id: r.id },
      title: r.type,
      dateLine: `${days < 0 ? "Ended" : "To"} ${formatDate(r.expiryDate)}`,
      sub: r.provider?.trim() || null,
      days,
      span: spanOf(r.startDate, r.expiryDate),
      tone: toneOfDays(days),
      km: null,
      label: `${r.type}, ${ringWords(days)}`,
    });
  }

  if (oil.has) {
    const k = oil.km ? { ...oil.km, share: oil.km.of > 0 ? Math.min(1, oil.km.driven / oil.km.of) : 0 } : null;
    const days = oil.days;
    cards.push({
      key: `service:${oil.serviceId}`,
      item: { kind: "service", id: oil.serviceId },
      title: "Oil change",
      dateLine: oil.markerDate ? `${days !== null && days < 0 ? "Was due" : "By"} ${formatDate(oil.markerDate)}` : `Last ${formatDate(oil.serviceDate)}`,
      sub: oil.markerDate ? null : "No reminder set",
      days,
      span: oil.span,
      tone: days === null ? null : toneOfDays(days),
      km: k,
      label: days === null ? "Oil change, no reminder set" : `Oil change, ${ringWords(days)}`,
    });
  } else if (input.hasAnyRecord) {
    cards.push({ key: "oil:none", item: null, title: "Oil change", dateLine: null, sub: "No oil change recorded yet", days: null, span: DEFAULT_OIL_SPAN, tone: null, km: null, label: "Oil change, none recorded yet" });
  }

  // Soonest first; the ones with no date (nothing to count down) last, in the order they were made.
  return cards
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (a.c.days ?? Number.POSITIVE_INFINITY) - (b.c.days ?? Number.POSITIVE_INFINITY) || a.i - b.i)
    .map(({ c }) => c);
}

// ---------------------------------------------------------------------------------------------
// The timeline
// ---------------------------------------------------------------------------------------------

export type TimelineEntry = {
  key: string;
  /** The day it happened, "YYYY-MM-DD". */
  date: string;
  /** The small mono date: "20 NOV", with the year when it is not this one. */
  dateLabel: string;
  /** Which marker shape: a ring for a reading, a square for a service, a diamond for an emission test, a rounded square for another paper. */
  marker: "reading" | "service" | "emission" | "paper";
  title: string;
  detail: string | null;
  /** What a click opens; null for a reading, which has no sheet. */
  item: ItemRef | null;
  /** Ties on the same day: the one entered last first. */
  at: number;
};

function labelOf(date: string, today: string): string {
  const base = dayMonth(date);
  return date.slice(0, 4) === today.slice(0, 4) ? base : `${base} ${date.slice(0, 4)}`;
}

/**
 * Recent events of a vehicle, newest first: its services, renewals and odometer readings. A renewal is dated by
 * the day it starts (the day it took over), or by the day it was entered when it has no start. Each entry says
 * what it is and a line of real facts (never a number that identifies a paper, C137).
 */
export function buildTimeline(input: {
  today: string;
  timeZone: string;
  renewals: readonly OverviewRenewal[];
  services: readonly OverviewService[];
  readings: readonly OverviewReading[];
}): TimelineEntry[] {
  const { today } = input;
  const entries: TimelineEntry[] = [];

  for (const s of input.services) {
    entries.push({
      key: `service:${s.id}`,
      date: s.serviceDate,
      dateLabel: labelOf(s.serviceDate, today),
      marker: "service",
      title: s.serviceType,
      detail: [s.odometerKm !== null ? km(s.odometerKm) : null, s.garage?.trim() || null].filter(Boolean).join(" · ") || null,
      item: { kind: "service", id: s.id },
      at: s.createdAt.getTime(),
    });
  }

  for (const r of input.renewals) {
    const date = r.startDate ?? todayIn(input.timeZone, r.createdAt);
    const earlierOfType = input.renewals.some((o) => o.id !== r.id && o.type.trim().toLowerCase() === r.type.trim().toLowerCase() && o.expiryDate < r.expiryDate);
    entries.push({
      key: `renewal:${r.id}`,
      date,
      dateLabel: labelOf(date, today),
      marker: r.type.trim().toLowerCase() === "emission test" ? "emission" : "paper",
      title: `${r.type} ${earlierOfType ? "renewed" : "added"}`,
      detail: [`to ${formatDate(r.expiryDate)}`, r.provider?.trim() || null, r.amount !== null ? formatMoney(Number(r.amount)) : null].filter(Boolean).join(" · "),
      item: { kind: "renewal", id: r.id },
      at: r.createdAt.getTime(),
    });
  }

  for (const o of input.readings) {
    entries.push({
      key: `reading:${o.id}`,
      date: o.readingDate,
      dateLabel: labelOf(o.readingDate, today),
      marker: "reading",
      title: "Odometer reading",
      detail: km(o.km),
      item: null,
      at: o.createdAt.getTime(),
    });
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at || a.key.localeCompare(b.key));
}

/** The first `shown` entries and how many are left behind "Show more". */
export function pageOf<T>(list: readonly T[], shown: number): { visible: T[]; hidden: number } {
  const n = Math.max(0, Math.floor(shown));
  return { visible: list.slice(0, n), hidden: Math.max(0, list.length - n) };
}

/** How many entries the timeline shows to begin with, and how many more each "Show more" adds. */
export const TIMELINE_FIRST = 5;
export const TIMELINE_MORE = 10;

// ---------------------------------------------------------------------------------------------
// A vehicle with nothing recorded
// ---------------------------------------------------------------------------------------------

/** True when there is nothing to show in the cards, services and timeline (V.4 adds the checklist for a new vehicle). */
export function isBlank(input: { renewals: readonly unknown[]; services: readonly unknown[]; readings: readonly unknown[] }): boolean {
  return input.renewals.length === 0 && input.services.length === 0 && input.readings.length === 0;
}
