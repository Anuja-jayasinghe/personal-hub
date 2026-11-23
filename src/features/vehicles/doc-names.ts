import { plateParts } from "./plate";

/**
 * The file names the hub gives vehicle documents (issue #179): `PLATE_type_date.ext`, e.g.
 * `CAB-1234_license_2027-09-23.pdf`. The uploader's own file name is never used: the plate comes from
 * the vehicle, the type and date from the renewal or from what the upload form asks, and the
 * extension from the file type the server checked. Pure, so it is testable and the form can show the
 * name before saving.
 */

export type DocKind = "book" | "license" | "emission" | "insurance" | "other";

/** What the Documents upload asks: the kind of paper, and which date goes in its name. */
export const DOC_KINDS: readonly { key: DocKind; label: string; dateLabel: string }[] = [
  { key: "book", label: "Registration book", dateLabel: "Printed on" },
  { key: "license", label: "Revenue license", dateLabel: "Valid until" },
  { key: "emission", label: "Emission test", dateLabel: "Valid until" },
  { key: "insurance", label: "Insurance", dateLabel: "Valid until" },
  { key: "other", label: "Other", dateLabel: "Date" },
];

export function isDocKind(value: unknown): value is DocKind {
  return DOC_KINDS.some((k) => k.key === value);
}

const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

/** The extension for a checked file type; anything unexpected becomes "bin" rather than trusting a name. */
export function extensionFor(mimeType: string): string {
  return EXTENSIONS[mimeType.toLowerCase()] ?? "bin";
}

/** Letters, digits and single dashes only. */
function slug(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * The vehicle part of the name: its plate without the province ("WP CAB-1234" → "CAB-1234"), or its
 * nickname when it has no plate, so a name always says which vehicle it is.
 */
export function vehiclePart(vehicle: { registrationNumber: string | null; nickname: string }): string {
  const plate = vehicle.registrationNumber ? slug(plateParts(vehicle.registrationNumber).main).toUpperCase() : "";
  return plate || slug(vehicle.nickname).toUpperCase() || "VEHICLE";
}

/** The type part for a renewal type label: the three known ones by key, any other by its own words. */
export function renewalKind(typeLabel: string): string {
  const t = typeLabel.trim().toLowerCase();
  if (t.startsWith("revenue")) return "license";
  if (t.startsWith("emission")) return "emission";
  if (t.startsWith("insurance")) return "insurance";
  return slug(t).toLowerCase() || "renewal";
}

/** The type part for a Documents upload: the kind, or for "Other" the words of its title. */
export function documentKind(kind: DocKind, title: string | null): string {
  if (kind !== "other") return kind;
  const words = slug(title ?? "").toLowerCase() || "other";
  // An "Other" paper titled like a kind ("Insurance") must not get that kind's name, or it would be read
  // back as that kind (issue #187): it becomes "other-insurance".
  return isDocKind(words) && words !== "other" ? `other-${words}` : words;
}

/**
 * The full name. `taken` holds the names the same record's files already have; a clash gets `_2`,
 * `_3`... (a licence scanned front and back), so two files never share a name.
 */
export function docFileName(parts: { vehicle: string; kind: string; date: string; ext: string }, taken: readonly string[] = []): string {
  return uniqueName(`${parts.vehicle}_${parts.kind}_${parts.date}`, parts.ext, taken);
}

function uniqueName(base: string, ext: string, taken: readonly string[]): string {
  const used = new Set(taken.map((n) => n.toLowerCase()));
  if (!used.has(`${base}.${ext}`.toLowerCase())) return `${base}.${ext}`;
  for (let i = 2; ; i++) {
    const name = `${base}_${i}.${ext}`;
    if (!used.has(name.toLowerCase())) return name;
  }
}

/**
 * The name a replacement file gets (issue #187): the name of the file it replaces, with the new file's
 * extension, kept unique among the record's other files. A hub name loses its `_2` first, so replacing
 * the only file of a record gives back the plain name.
 */
export function replacementName(oldName: string, ext: string, siblings: readonly string[]): string {
  const stem = oldName.replace(/\.[A-Za-z0-9]{1,5}$/, "");
  const hub = /^([A-Za-z0-9-]+_[a-z0-9-]+_\d{4}-\d{2}-\d{2})(?:_\d+)?$/i.exec(stem);
  return uniqueName(hub ? hub[1] : stem || "file", ext, siblings);
}

/** The title a Documents upload gets when none is typed: the kind, and its date unless it is a book. */
export function defaultDocTitle(kind: DocKind, date: string): string {
  const label = DOC_KINDS.find((k) => k.key === kind)?.label ?? "Document";
  if (kind === "book") return label;
  if (kind === "other") return `Document ${date}`;
  return `${label} until ${date}`;
}

export type DocUpload = { kind: DocKind; date: string; title: string };

/**
 * What the Documents upload form sends: the kind and its date are required (they make the name), the
 * title is optional except for "Other", where it is what the document is.
 */
export function parseDocUpload(raw: { kind?: string; date?: string; title?: string }, titleMax: number): { ok: true; value: DocUpload } | { ok: false; error: string } {
  const kind = (raw.kind ?? "").trim();
  if (!isDocKind(kind)) return { ok: false, error: "Choose what the document is." };
  const date = (raw.date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    return { ok: false, error: "Give the document's date." };
  }
  const title = (raw.title ?? "").trim().replace(/\s+/g, " ");
  if (title.length > titleMax) return { ok: false, error: `The title must be at most ${titleMax} characters.` };
  if (kind === "other" && !title) return { ok: false, error: "Say what the document is, e.g. “Service invoice”." };
  return { ok: true, value: { kind, date, title: title || defaultDocTitle(kind, date) } };
}
