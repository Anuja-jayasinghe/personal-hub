import { appConfig } from "@/config/app.config";

/**
 * The numbers you can change in Settings (S.2b, C107): the slab rule, how often the meters are read, the
 * billing cycle, and how many days ahead reminders start. app.config.ts holds the defaults; what you save
 * is kept in the app_settings table under RULES_KEY and wins. Pure: no database here.
 */

export type HubRules = {
  lowUnits: number;
  highUnits: number;
  nearUnits: number;
  checkEveryDays: number;
  billingCycleDays: number;
  /** Days before a due date that an item shows up, newest first; 0 = on the day. */
  leadDays: number[];
  /** The oil-change marker (V.1a, C147): months after an oil-change service, and the km it is shown beside (a glance only, C24). */
  oilChangeMonths: number;
  oilChangeKm: number;
  /** The service types that set the marker, compared with `typeKey` so case and spacing do not matter. */
  oilChangeTypes: string[];
};

export const RULES_KEY = "rules";

/** The reminder days you can pick from in Settings. */
export const LEAD_DAY_CHOICES = [90, 60, 30, 14, 7, 3, 1, 0] as const;

export const DEFAULT_RULES: HubRules = {
  lowUnits: appConfig.electricity.limits.lowUnits,
  highUnits: appConfig.electricity.limits.highUnits,
  nearUnits: appConfig.electricity.limits.nearUnits,
  checkEveryDays: appConfig.electricity.checkEveryDays,
  billingCycleDays: appConfig.electricity.billingCycleDays,
  leadDays: [...appConfig.reminders.leadDays],
  oilChangeMonths: appConfig.vehicles.oilChange.months,
  oilChangeKm: appConfig.vehicles.oilChange.km,
  oilChangeTypes: [...appConfig.vehicles.oilChange.types],
};

/** Allowed range for each number, also used for the − / + steppers. */
export const RULE_LIMITS = {
  lowUnits: { min: 10, max: 1000 },
  highUnits: { min: 20, max: 2000 },
  nearUnits: { min: 1, max: 100 },
  checkEveryDays: { min: 1, max: 31 },
  billingCycleDays: { min: 20, max: 40 },
} as const;

/** Allowed range for the oil-change numbers (V.1a, C147), also used for the − / + steppers. */
export const OIL_LIMITS = {
  oilChangeMonths: { min: 1, max: 24 },
  oilChangeKm: { min: 500, max: 20000 },
} as const;

/** How many service types the oil-change list may hold; each may be as long as the service form allows (60). */
export const OIL_TYPES_MAX = 10;
const OIL_TYPE_LENGTH = 60;

type NumberKey = keyof typeof RULE_LIMITS;

function wholeIn(value: unknown, key: NumberKey): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isInteger(n)) return null;
  const { min, max } = RULE_LIMITS[key];
  return n >= min && n <= max ? n : null;
}

/** Cleans a list of reminder days: only the offered choices, no repeats, largest first. */
export function cleanLeadDays(values: readonly unknown[]): number[] {
  const allowed = new Set<number>(LEAD_DAY_CHOICES);
  const picked = new Set<number>();
  for (const v of values) {
    const n = typeof v === "number" ? v : Number(v);
    if (allowed.has(n)) picked.add(n);
  }
  return [...picked].sort((a, b) => b - a);
}

export type SlabInput = Pick<HubRules, "lowUnits" | "highUnits" | "nearUnits" | "checkEveryDays" | "billingCycleDays">;

/** Checks the slab numbers from the form; says what is wrong in plain words. */
export function parseSlabRules(raw: Record<string, unknown>): { ok: true; value: SlabInput } | { ok: false; error: string } {
  const value = {} as SlabInput;
  const names: Record<NumberKey, string> = {
    lowUnits: "The low slab",
    highUnits: "The high slab",
    nearUnits: "The warning",
    checkEveryDays: "How often you read the meters",
    billingCycleDays: "The billing cycle",
  };
  for (const key of Object.keys(RULE_LIMITS) as NumberKey[]) {
    const n = wholeIn(raw[key], key);
    if (n === null) return { ok: false, error: `${names[key]} must be a whole number from ${RULE_LIMITS[key].min} to ${RULE_LIMITS[key].max}.` };
    value[key] = n;
  }
  if (value.highUnits <= value.lowUnits) return { ok: false, error: "The high slab must be more than the low slab." };
  if (value.nearUnits >= value.lowUnits) return { ok: false, error: "The warning must be smaller than the low slab." };
  return { ok: true, value };
}

export type OilInput = Pick<HubRules, "oilChangeMonths" | "oilChangeKm" | "oilChangeTypes">;

/**
 * Cleans the service types that set the oil-change marker: trimmed, spaces squeezed, no repeats (ignoring
 * case and spacing, like `typeKey`), at most OIL_TYPES_MAX. The result may be empty.
 */
export function cleanOilTypes(values: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (typeof v !== "string") continue;
    const t = v.trim().replace(/\s+/g, " ");
    const key = t.toLowerCase();
    if (!t || t.length > OIL_TYPE_LENGTH || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= OIL_TYPES_MAX) break;
  }
  return out;
}

function oilNumber(value: unknown, key: keyof typeof OIL_LIMITS): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isInteger(n)) return null;
  const { min, max } = OIL_LIMITS[key];
  return n >= min && n <= max ? n : null;
}

/** The list a form or a saved value gives, as strings: an array, or text separated by commas or lines. */
function oilTypeList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  return typeof raw === "string" ? raw.split(/[,\n]/) : [];
}

/** Checks the oil-change numbers and types from the form; says what is wrong in plain words. */
export function parseOilRules(raw: Record<string, unknown>): { ok: true; value: OilInput } | { ok: false; error: string } {
  const months = oilNumber(raw.oilChangeMonths, "oilChangeMonths");
  if (months === null) return { ok: false, error: `The months must be a whole number from ${OIL_LIMITS.oilChangeMonths.min} to ${OIL_LIMITS.oilChangeMonths.max}.` };
  const km = oilNumber(raw.oilChangeKm, "oilChangeKm");
  if (km === null) return { ok: false, error: `The km must be a whole number from ${OIL_LIMITS.oilChangeKm.min} to ${OIL_LIMITS.oilChangeKm.max}.` };
  const types = cleanOilTypes(oilTypeList(raw.oilChangeTypes));
  if (types.length === 0) return { ok: false, error: "Name at least one service type that sets the oil-change date." };
  return { ok: true, value: { oilChangeMonths: months, oilChangeKm: km, oilChangeTypes: types } };
}

/** What is saved, laid over the defaults. Anything missing or invalid falls back to the default. */
export function mergeRules(stored: unknown): HubRules {
  if (!stored || typeof stored !== "object") return { ...DEFAULT_RULES, leadDays: [...DEFAULT_RULES.leadDays], oilChangeTypes: [...DEFAULT_RULES.oilChangeTypes] };
  const s = stored as Record<string, unknown>;
  const slab = parseSlabRules({ ...DEFAULT_RULES, ...s });
  const leadDays = Array.isArray(s.leadDays) ? cleanLeadDays(s.leadDays) : [];
  // Each part is checked on its own, so one bad saved value never resets the others; the oil-change
  // numbers and types fall back one by one.
  const types = cleanOilTypes(oilTypeList(s.oilChangeTypes));
  return {
    ...(slab.ok ? slab.value : DEFAULT_RULES),
    leadDays: leadDays.length > 0 ? leadDays : [...DEFAULT_RULES.leadDays],
    oilChangeMonths: oilNumber(s.oilChangeMonths, "oilChangeMonths") ?? DEFAULT_RULES.oilChangeMonths,
    oilChangeKm: oilNumber(s.oilChangeKm, "oilChangeKm") ?? DEFAULT_RULES.oilChangeKm,
    oilChangeTypes: types.length > 0 ? types : [...DEFAULT_RULES.oilChangeTypes],
  };
}

/** The limits in whole units, for the wording. */
export function unitsOf(rules: Pick<HubRules, "lowUnits" | "highUnits">) {
  return { low: rules.lowUnits, high: rules.highUnits };
}
