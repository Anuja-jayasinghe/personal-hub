import { addDays, addMonthsToDate, dayMonth, daysBetween, isValidDate } from "@/lib/dates";
import { documentKind, docFileName, extensionFor, parseDocUpload, renewalKind, SERVICE_FILE_KIND, type DocKind, type DocUpload } from "./doc-names";
import { DOC_TITLE_MAX } from "./documents";
import { parseRenewal, type RenewalFields } from "./renewal-validate";
import { serviceToStore, type OilRules } from "./service-logic";
import type { ServiceFields } from "./service-validate";

/**
 * The one flow for adding a paper (V.1b, C148). Pure: plain values in and out, no database, clock or FormData, so the
 * sheet in the browser and the Server Actions use the very same rules (the sheet to show its "Saved as" preview and
 * to say what is wrong early, the actions to decide, since the server never trusts the browser).
 *
 * A paper is one of six kinds. What saving it does depends on what the signed-in person may do:
 *   - Add in Vehicles lets them make the record (a renewal or a service),
 *   - Add in Vehicle documents lets them put the file on it,
 *   - both: the record and its file together; only documents: the paper is kept as an "on file" document with no
 *     record (the way the old Add a document form did); only vehicles: the record, with no scan yet; neither: refused.
 */

export type PaperKind = "license" | "insurance" | "emission" | "book" | "service" | "other";

/** The chips of step 2, in the order the owner chose. */
export const PAPER_KINDS: readonly { key: PaperKind; label: string }[] = [
  { key: "license", label: "Revenue license" },
  { key: "insurance", label: "Insurance" },
  { key: "emission", label: "Emission test" },
  { key: "book", label: "Registration book" },
  { key: "service", label: "Service invoice" },
  { key: "other", label: "Other" },
];

export function isPaperKind(value: unknown): value is PaperKind {
  return PAPER_KINDS.some((k) => k.key === value);
}

/** The three kinds that make a renewal. */
export type RenewalPaperKind = "license" | "insurance" | "emission";
export const isRenewalKind = (kind: PaperKind): kind is RenewalPaperKind => kind === "license" || kind === "insurance" || kind === "emission";

/** What the signed-in person may do, worked out on the server from their access. */
export type PaperCan = { records: boolean; files: boolean };

/** What saving a kind does for this person: make its record (maybe with the file), keep the file only, or nothing. */
export type PaperMode = "record" | "document";

export function paperMode(kind: PaperKind, can: PaperCan): PaperMode | null {
  const makesRecord = isRenewalKind(kind) || kind === "service";
  if (makesRecord && can.records) return "record";
  return can.files ? "document" : null;
}

/** The chips this person can use: someone who can only add records has no use for the book or "Other". */
export function kindsFor(can: PaperCan): readonly { key: PaperKind; label: string }[] {
  return PAPER_KINDS.filter((k) => paperMode(k.key, can) !== null);
}

/** True when the sheet needs a file before it can save: nothing else would be saved. */
export function fileRequired(kind: PaperKind, can: PaperCan): boolean {
  return paperMode(kind, can) === "document";
}

/** One short line that says which of the combinations applies to this person (the sheet shows it). Null when everything is possible. */
export function accessLine(kind: PaperKind, can: PaperCan): string | null {
  const mode = paperMode(kind, can);
  if (mode === null) return "You cannot add papers here.";
  const makesRecord = isRenewalKind(kind) || kind === "service";
  if (!makesRecord) return null;
  if (mode === "document") return "You can add the file, but not the record: it is kept with the papers, with no reminders.";
  if (!can.files) return "You can add the record, but not the file: it is saved with no scan yet.";
  return null;
}

// ---------------------------------------------------------------------------------------------
// What to fill in for the person (never numbers: only dates and the provider's name)
// ---------------------------------------------------------------------------------------------

/** What the last record of a kind says, to prefill the next one. */
export type KindPrefill = {
  /** The council or office, the insurer or the test centre of the latest record. */
  provider: string | null;
  /** The last day the latest record is valid: the next one starts the day after. */
  lastExpiry: string | null;
  /** How long the latest record lasted, in whole months, when its start and end are both known. */
  spanMonths: number | null;
};
export type Prefill = Record<RenewalPaperKind, KindPrefill>;

export const EMPTY_PREFILL: Prefill = {
  license: { provider: null, lastExpiry: null, spanMonths: null },
  insurance: { provider: null, lastExpiry: null, spanMonths: null },
  emission: { provider: null, lastExpiry: null, spanMonths: null },
};

/** The kind a renewal type belongs to, or null for a type that is not one of the three. */
export function renewalPaperKind(type: string): RenewalPaperKind | null {
  const k = renewalKind(type);
  return k === "license" || k === "emission" || k === "insurance" ? k : null;
}

/** How many whole months a record lasted: its first day to the day after its last. Null when not both dates or not a sensible length. */
export function spanMonthsOf(start: string | null, expiry: string): number | null {
  if (!start || !isValidDate(start) || !isValidDate(expiry) || daysBetween(start, expiry) < 0) return null;
  const months = Math.round(daysBetween(start, addDays(expiry, 1)) / 30.4375);
  return months >= 1 && months <= 60 ? months : null;
}

/** The prefill of each kind from a vehicle's renewals: the one that ends last decides, however it was renewed since. */
export function prefillFrom(renewals: readonly { type: string; provider: string | null; startDate: string | null; expiryDate: string }[]): Prefill {
  const out: Prefill = { license: { ...EMPTY_PREFILL.license }, insurance: { ...EMPTY_PREFILL.insurance }, emission: { ...EMPTY_PREFILL.emission } };
  const newestFirst = [...renewals].sort((a, b) => b.expiryDate.localeCompare(a.expiryDate));
  for (const r of newestFirst) {
    const kind = renewalPaperKind(r.type);
    if (!kind) continue;
    const slot = out[kind];
    if (slot.lastExpiry === null) {
      slot.lastExpiry = r.expiryDate;
      slot.spanMonths = spanMonthsOf(r.startDate, r.expiryDate);
    }
    if (slot.provider === null && r.provider) slot.provider = r.provider;
  }
  return out;
}

/** The first day of the next record: the day after the last one ends, or today when there is none. */
export function defaultFrom(prefill: KindPrefill, today: string): string {
  return prefill.lastExpiry ? addDays(prefill.lastExpiry, 1) : today;
}

/**
 * The last day of a record of `months` months starting `from`: a year later minus a day for the usual year
 * (3 Mar 2026 gives 2 Mar 2027). When the day does not exist in the end month (29 Feb, 31 Aug) it is the end of
 * that month. Null for something that is not a real day.
 */
export function defaultUntil(from: string, months: number | null): string | null {
  if (!isValidDate(from)) return null;
  const next = addMonthsToDate(from, months ?? 12);
  const clamped = Number(next.slice(8, 10)) < Number(from.slice(8, 10));
  return clamped ? next : addDays(next, -1);
}

// ---------------------------------------------------------------------------------------------
// Reading what was typed
// ---------------------------------------------------------------------------------------------

/** What the form sends: text by field name, for the kind chosen. */
export type PaperRaw = Record<string, string | undefined>;

export type ParseOptions = {
  /** Today in the app time zone: the date of a registration book when none is typed. */
  today: string;
  /** The labels of the renewal types in app.config.ts. */
  renewalTypes: readonly string[];
  /** The vehicle's emission certificates print an inaccurate odometer (issue #184): never asked, never kept. */
  ignoreEmissionOdometer: boolean;
  /** The oil-change rule in force, for the next-oil-change marker. */
  oil: Pick<OilRules, "oilChangeMonths" | "oilChangeTypes">;
};

/** What a paper is once it is read; `nameKind` and `nameDate` make its file name (`PLATE_nameKind_nameDate.ext`). */
export type ParsedPaper =
  | { mode: "renewal"; kind: RenewalPaperKind; renewal: RenewalFields; nameKind: string; nameDate: string }
  | { mode: "service"; service: ServiceFields; nameKind: string; nameDate: string }
  | { mode: "document"; doc: DocUpload; nameKind: string; nameDate: string };

export type ParsePaperResult = { ok: true; value: ParsedPaper } | { ok: false; error: string };

/**
 * A paper kept as a document of the vehicle (no record): read by the same `parseDocUpload` the Documents upload
 * always used, so the date, the title and the file name follow one set of rules.
 */
function documentOf(kind: DocKind, date: string | undefined, title: string | null): ParsePaperResult {
  const parsed = parseDocUpload({ kind, date, title: title ?? "" }, DOC_TITLE_MAX);
  if (!parsed.ok) return parsed;
  const doc = parsed.value;
  return { ok: true, value: { mode: "document", doc, nameKind: documentKind(doc.kind, doc.kind === "other" ? doc.title : null), nameDate: doc.date } };
}

/**
 * Reads the fields of one kind for a person with this `can`. The same validators as everywhere else
 * (`parseRenewal`, `parseService`, `parseDocUpload`), so a paper saved here is never different from one saved
 * through the old forms. Policy, licence and certificate numbers are never read (C137).
 */
export function parsePaper(kind: PaperKind, can: PaperCan, raw: PaperRaw, opts: ParseOptions): ParsePaperResult {
  const mode = paperMode(kind, can);
  if (mode === null) return { ok: false, error: "You cannot add papers here." };

  if (isRenewalKind(kind)) {
    // Kept as an "on file" document: only the day it runs until is needed (it names the file).
    if (mode === "document") return documentOf(kind, raw.expiryDate, null);
    const type = opts.renewalTypes.find((t) => renewalPaperKind(t) === kind);
    if (!type) return { ok: false, error: "That kind of paper is not set up." };
    const odometerKm = opts.ignoreEmissionOdometer ? "" : raw.odometerKm;
    const parsed = parseRenewal({ type, provider: raw.provider, startDate: raw.startDate, expiryDate: raw.expiryDate, amount: raw.amount, odometerKm }, opts.renewalTypes);
    if (!parsed.ok) return parsed;
    return { ok: true, value: { mode: "renewal", kind, renewal: parsed.value, nameKind: renewalKind(type), nameDate: parsed.value.expiryDate } };
  }

  if (kind === "service") {
    if (mode === "document") return documentOf("other", raw.serviceDate, "Service invoice");
    const result = serviceToStore(raw, raw.markerRemind !== "off", opts.oil);
    if (!result.ok) return result;
    return { ok: true, value: { mode: "service", service: result.value, nameKind: SERVICE_FILE_KIND, nameDate: result.value.serviceDate } };
  }

  // "Printed on" is optional: without it the day the book is added names the file.
  if (kind === "book") return documentOf("book", (raw.date ?? "").trim() || opts.today, null);

  // Other: what it is and a date; the words become its type in the file name.
  return documentOf("other", raw.date, raw.title ?? "");
}

/** The name the file will be saved as, from a parsed paper (the vehicle's part comes from `vehiclePart`). */
export function paperFileName(parsed: ParsedPaper, vehiclePart: string, mimeType: string, taken: readonly string[] = []): string {
  return docFileName({ vehicle: vehiclePart, kind: parsed.nameKind, date: parsed.nameDate, ext: extensionFor(mimeType) }, taken);
}

// ---------------------------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------------------------

/** A calendar day as written in the hub's messages, the same everywhere whatever the locale: "4 Oct 2026". */
export function dayText(ymd: string): string {
  return `${dayMonth(ymd)} ${ymd.slice(0, 4)}`;
}

/** "A license", "An insurance", "An emission test": the noun for messages about a kind of renewal. */
export function kindNoun(kind: RenewalPaperKind): string {
  return { license: "A license", insurance: "An insurance", emission: "An emission test" }[kind];
}

/** What to say when a record of the same kind and end date exists. `dateText` is the end date as written on screen. */
export function twinMessage(kind: RenewalPaperKind, dateText: string, hasFile: boolean): string {
  return hasFile ? `${kindNoun(kind)} ending ${dateText} is already saved with its scan.` : `${kindNoun(kind)} ending ${dateText} is already saved, without its scan.`;
}

/** The lines of "When you save", for what this person's save will really do. */
export function savingLines(
  kind: PaperKind,
  can: PaperCan,
  ctx: { hasFile: boolean; remind?: boolean; markerDateText?: string | null; hasOdometer?: boolean; hasPrevious?: boolean },
): string[] {
  const mode = paperMode(kind, can);
  if (mode === null) return [];
  if (mode === "document") {
    return [kind === "book" ? "The file is kept with the vehicle's papers" : "The file is kept with the vehicle's papers, as a paper on file", "It shows under Documents"];
  }
  const withFile = ctx.hasFile && can.files;
  if (kind === "service") {
    const lines = [withFile ? "The service is recorded, with the invoice on it" : "The service is recorded, with no invoice yet"];
    if (ctx.hasOdometer) lines.push("The odometer reading joins the timeline");
    if (ctx.markerDateText) lines.push(`The oil-change reminder is set for ${ctx.markerDateText}`);
    return lines;
  }
  const noun = kind === "license" ? "license" : kind === "insurance" ? "insurance" : "emission test";
  const lines = [withFile ? `The ${noun} record is made, with this file on it` : `The ${noun} record is made, with no scan yet`];
  if (ctx.hasPrevious) lines.push(`The last ${noun} is marked renewed`);
  lines.push("Reminders and notices follow the new end date");
  if (can.files) lines.push("It shows in Documents and on the timeline");
  return lines;
}

// ---------------------------------------------------------------------------------------------
// What the browser and the actions say to each other
// ---------------------------------------------------------------------------------------------

/** What the sheet needs about one vehicle and the person (built on the server by `paperContext`; plain values only). */
export type PaperContext = {
  vehicleId: string;
  vehicleName: string;
  /** The vehicle part of file names, for the "Saved as" preview. */
  namePrefix: string;
  /** Today, "YYYY-MM-DD" in the app time zone. */
  today: string;
  serviceTypes: readonly string[];
  renewalTypes: readonly string[];
  oil: OilRules;
  can: PaperCan;
  /** False when the vehicle's emission certificates print an inaccurate odometer (issue #184). */
  askOdometer: boolean;
  prefill: Prefill;
};

/** What the browser sends: the kind and what was typed. The server decides everything else. */
export type PaperInput = {
  vehicleId: string;
  kind: string;
  fields: Record<string, string>;
  /** "Attach the file to it": the file goes on the same-day record that has no scan, instead of a new record. */
  attach?: boolean;
  /** Step 1: the file the browser is about to upload. */
  file?: { fileName: string; mimeType: string; size: number };
  /** Step 2: where the browser uploaded it (the path and the record id from step 1). */
  upload?: { path: string; ownerId: string };
};

export type PreparePaperResult = { ok: true; ownerId: string; path: string; signedUrl: string } | { ok: false; error: string; canAttach?: boolean };
export type SavePaperResult = { ok: true } | { ok: false; error: string; canAttach?: boolean };

/** The Save button's words: what is being saved, in the owner's wording ("Save the license"). */
export function saveLabel(kind: PaperKind | null): string {
  switch (kind) {
    case "license":
      return "Save the license";
    case "insurance":
      return "Save the insurance";
    case "emission":
      return "Save the emission test";
    case "book":
      return "Save the registration book";
    case "service":
      return "Save the service";
    case "other":
      return "Save the paper";
    default:
      return "Choose what it is";
  }
}

/**
 * The name the file will get, from what is typed so far, so the sheet can show "Saved as ..." before anything is
 * saved. Null until the date the name needs is a real day (and, for Other, its words are typed). The server
 * names the real file with `parsePaper` and `paperFileName`; this only reads the same fields leniently.
 */
export function previewName(
  kind: PaperKind,
  can: PaperCan,
  v: { expiryDate?: string; serviceDate?: string; date?: string; title?: string },
  namePrefix: string,
  mimeType: string,
  today: string,
): string | null {
  const mode = paperMode(kind, can);
  if (mode === null) return null;
  const day = (d: string | undefined) => (d && isValidDate(d.trim()) ? d.trim() : null);
  let nameKind: string;
  let nameDate: string | null;
  if (isRenewalKind(kind)) {
    nameKind = kind;
    nameDate = day(v.expiryDate);
  } else if (kind === "service") {
    nameKind = mode === "record" ? SERVICE_FILE_KIND : documentKind("other", "Service invoice");
    nameDate = day(v.serviceDate);
  } else if (kind === "book") {
    nameKind = "book";
    nameDate = day(v.date) ?? ((v.date ?? "").trim() ? null : today);
  } else {
    const title = (v.title ?? "").trim().replace(/\s+/g, " ");
    if (!title) return null;
    nameKind = documentKind("other", title);
    nameDate = day(v.date);
  }
  return nameDate ? docFileName({ vehicle: namePrefix, kind: nameKind, date: nameDate, ext: extensionFor(mimeType) }) : null;
}
