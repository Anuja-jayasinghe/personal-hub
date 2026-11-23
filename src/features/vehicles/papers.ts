import { addDays, daysBetween, isValidDate } from "@/lib/dates";
import { DOC_KINDS, defaultDocTitle, isDocKind, renewalKind, type DocKind } from "./doc-names";

/**
 * A vehicle's papers by category (issue #187, C138): the Documents tab shows every paper of a vehicle in
 * one place, the files uploaded on the tab and the files on its renewals, grouped by what they are
 * (registration book, revenue license, emission test, insurance, other). Each category has its current
 * paper and the earlier ones, with the gaps between them worked out from the dates.
 *
 * Pure: plain values in and out, no database, clock or FormData, so it is easy to test. The database has
 * no "kind" column: a Documents upload's kind and date come from the name the hub gave it
 * (`PLATE_kind_date.ext`, C134), or for older files from words in its title or name.
 */

/** One stored file, as much of an attachment row as the tab needs. */
export type PaperFile = { id: string; ownerType: string; ownerId: string; fileName: string; title: string | null; mimeType: string; sizeBytes: number; createdAt: Date };

/** As much of a renewal row as the tab needs. */
export type RenewalLike = {
  id: string;
  type: string;
  provider: string | null;
  startDate: string | null;
  expiryDate: string;
  amount: string | null;
  renewedAt: Date | null;
  createdAt: Date;
};

export type Paper = {
  /** "r:<renewal id>" or "d:<attachment id>", unique within a vehicle. */
  key: string;
  kind: DocKind;
  /** The renewal it belongs to, when it came from the Renewals tab. That tab owns the record (one home per action). */
  renewalId: string | null;
  /** A name worth showing: the renewal's provider, or a title the owner typed. Null when it would only repeat the kind and date. */
  name: string | null;
  /** First day it is valid, when known (renewals only). */
  start: string | null;
  /** Last day it is valid: a renewal's expiry, or the date of a license, emission test or insurance upload. */
  until: string | null;
  /** The date of a book ("printed on") or another paper. */
  dated: string | null;
  amount: string | null;
  /** Oldest first; a renewal can have several (a license scanned front and back) or none yet. */
  files: PaperFile[];
  addedAt: Date;
};

export type PaperStatus =
  | { tone: "ok" | "soon" | "overdue"; days: number }
  | { tone: "file"; count: number }
  | { tone: "none" };

export type TimelineEntry = { type: "paper"; paper: Paper } | { type: "gap"; from: string; to: string };

export type PaperGroup = {
  kind: DocKind;
  label: string;
  /** The paper in force (or the latest one). Null for "Other", whose papers are not versions of one another. */
  current: Paper | null;
  /** The rest, newest first. */
  earlier: Paper[];
  /** `earlier` with the gaps between papers put in, newest first. */
  timeline: TimelineEntry[];
  status: PaperStatus;
};

/** Kinds that run out: their papers have a "valid until" and a days-left count. */
export const DATED_KINDS: readonly DocKind[] = ["license", "emission", "insurance"];
export const isDatedKind = (kind: DocKind) => DATED_KINDS.includes(kind);

/** A break shorter than this between one paper's end and the next one's start is a late renewal, not a gap. */
export const GAP_MIN_DAYS = 31;

export function kindLabel(kind: DocKind): string {
  return DOC_KINDS.find((k) => k.key === kind)?.label ?? "Other";
}

/** The category of a renewal type: the three known ones, anything else configured counts as "Other". */
export function kindOfRenewalType(type: string): DocKind {
  const k = renewalKind(type);
  return k === "license" || k === "emission" || k === "insurance" ? k : "other";
}

const HUB_NAME = /^[A-Za-z0-9-]+_([a-z0-9-]+)_(\d{4}-\d{2}-\d{2})(?:_\d+)?\.[a-z0-9]+$/i;

/** The kind and date in a name the hub gave (`CAB-1234_insurance_2027-05-01.pdf`, C134); null for any other name. */
export function parseHubName(fileName: string): { kind: DocKind; date: string } | null {
  const m = HUB_NAME.exec(fileName.trim());
  if (!m || !isValidDate(m[2])) return null;
  const slug = m[1].toLowerCase();
  return { kind: isDocKind(slug) ? slug : "other", date: m[2] };
}

/** For files named before C134: the kind from words in the title or file name. */
export function guessKind(text: string): DocKind {
  const t = text.toLowerCase();
  if (/insur/.test(t)) return "insurance";
  if (/emission|eco ?test|smoke/.test(t)) return "emission";
  if (/licen[cs]e|revenue/.test(t)) return "license";
  if (/registration|\bbook\b|\bcr\b/.test(t)) return "book";
  return "other";
}

/** A paper uploaded on the Documents tab. */
export function paperFromDocument(file: PaperFile): Paper {
  const named = parseHubName(file.fileName);
  const kind = named?.kind ?? guessKind(`${file.title ?? ""} ${file.fileName}`);
  const date = named?.date ?? /\b(\d{4}-\d{2}-\d{2})\b/.exec(file.title ?? "")?.[1] ?? null;
  const usableDate = date && isValidDate(date) ? date : null;
  const title = file.title?.trim() || null;
  // A title the hub made itself ("Insurance until 2027-05-01") only repeats the category and the date.
  const madeUp = title !== null && (title === kindLabel(kind) || (usableDate !== null && title === defaultDocTitle(kind, usableDate)));
  const dated = isDatedKind(kind);
  return {
    key: `d:${file.id}`,
    kind,
    renewalId: null,
    name: madeUp ? null : title,
    start: null,
    until: dated ? usableDate : null,
    dated: dated ? null : usableDate,
    amount: null,
    files: [file],
    addedAt: file.createdAt,
  };
}

/** A renewal and the files on it. */
export function paperFromRenewal(r: RenewalLike, files: readonly PaperFile[]): Paper {
  const kind = kindOfRenewalType(r.type);
  const dated = isDatedKind(kind);
  return {
    key: `r:${r.id}`,
    kind,
    renewalId: r.id,
    // A renewal of a type outside the three keeps its type as its name, so "Other" still says what it is.
    name: r.provider?.trim() || (dated ? null : r.type),
    start: r.startDate,
    until: dated ? r.expiryDate : null,
    dated: dated ? null : r.expiryDate,
    amount: r.amount,
    files: [...files].sort(byOldest),
    addedAt: r.createdAt,
  };
}

const byOldest = (a: PaperFile, b: PaperFile) => a.createdAt.getTime() - b.createdAt.getTime();

/**
 * Every paper of a vehicle: one per renewal (with its files, or none yet) and one per Documents upload.
 * A Documents upload of the same kind and "valid until" as a renewal is the same paper, so its file joins
 * that renewal instead of showing twice.
 */
export function buildPapers(input: {
  renewals: readonly RenewalLike[];
  renewalFiles: ReadonlyMap<string, readonly PaperFile[]>;
  documents: readonly PaperFile[];
}): Paper[] {
  const papers = input.renewals.map((r) => paperFromRenewal(r, input.renewalFiles.get(r.id) ?? []));
  for (const file of input.documents) {
    const doc = paperFromDocument(file);
    const twin = doc.until ? papers.find((p) => p.renewalId && p.kind === doc.kind && p.until === doc.until) : undefined;
    if (twin) twin.files = [...twin.files, file].sort(byOldest);
    else papers.push(doc);
  }
  return papers;
}

/** Newest first: by the date that counts for the kind, then the one entered last. */
function newestFirst(a: Paper, b: Paper): number {
  const da = a.until ?? a.dated ?? "";
  const db = b.until ?? b.dated ?? "";
  if (da !== db) return da < db ? 1 : -1;
  return b.addedAt.getTime() - a.addedAt.getTime();
}

/** The gap between a newer paper and the one before it, when its start is known and the break is long enough. */
export function gapBetween(newer: Paper, older: Paper): { from: string; to: string } | null {
  if (!newer.start || !older.until) return null;
  if (daysBetween(older.until, newer.start) <= GAP_MIN_DAYS) return null;
  return { from: addDays(older.until, 1), to: addDays(newer.start, -1) };
}

/** The earlier papers with the gaps put in: a gap sits between the paper after it and the one before it. */
export function timelineOf(current: Paper | null, earlier: readonly Paper[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  earlier.forEach((paper, i) => {
    const newer = i === 0 ? current : earlier[i - 1];
    const gap = newer ? gapBetween(newer, paper) : null;
    if (gap) entries.push({ type: "gap", ...gap });
    entries.push({ type: "paper", paper });
  });
  return entries;
}

/** Green over 30 days, amber inside 30, red inside 7 or past: the same steps as the countdown ring. */
export function toneOfDays(days: number): "ok" | "soon" | "overdue" {
  return days <= 7 ? "overdue" : days <= 30 ? "soon" : "ok";
}

/** "81 days left", "expires today", "expired 3 days ago". */
export function daysWords(days: number): string {
  if (days === 0) return "expires today";
  if (days < 0) return `expired ${-days} day${days === -1 ? "" : "s"} ago`;
  return `${days} day${days === 1 ? "" : "s"} left`;
}

/** One group per kind, in the fixed order of DOC_KINDS (the at-a-glance row). */
export function groupPapers(papers: readonly Paper[], today: string): PaperGroup[] {
  return DOC_KINDS.map(({ key: kind, label }) => {
    const mine = papers.filter((p) => p.kind === kind).sort(newestFirst);
    if (kind === "other") {
      return { kind, label, current: null, earlier: mine, timeline: mine.map((paper) => ({ type: "paper" as const, paper })), status: mine.length ? { tone: "file" as const, count: mine.length } : { tone: "none" as const } };
    }
    const [current = null, ...earlier] = mine;
    let status: PaperStatus = { tone: "none" };
    if (current && isDatedKind(kind) && current.until) {
      const days = daysBetween(today, current.until);
      status = { tone: toneOfDays(days), days };
    } else if (current) {
      status = { tone: "file", count: mine.length };
    }
    return { kind, label, current, earlier, timeline: isDatedKind(kind) ? timelineOf(current, earlier) : earlier.map((paper) => ({ type: "paper" as const, paper })), status };
  });
}

/**
 * Most urgent first: papers that run out, soonest (or longest expired) first; then the book on file; then
 * other papers; then the categories with nothing in them, in their usual order.
 */
export function byUrgency(groups: readonly PaperGroup[]): PaperGroup[] {
  const rank = (g: PaperGroup) => {
    if (g.status.tone === "none") return 3;
    if (g.status.tone === "file") return g.kind === "other" ? 2 : 1;
    return 0;
  };
  const order = (g: PaperGroup) => DOC_KINDS.findIndex((k) => k.key === g.kind);
  return [...groups].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    if ("days" in a.status && "days" in b.status) return a.status.days - b.status.days || order(a) - order(b);
    return order(a) - order(b);
  });
}

/** Papers whose name, kind, provider or file names contain every word of `query` (any case), newest first. */
export function searchPapers(papers: readonly Paper[], query: string): Paper[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return papers
    .filter((p) => {
      const haystack = [p.name, kindLabel(p.kind), ...p.files.flatMap((f) => [f.fileName, f.title])].filter(Boolean).join(" ").toLowerCase();
      return words.every((w) => haystack.includes(w));
    })
    .sort(newestFirst);
}
