import { appConfig } from "@/config/app.config";
import { addDays, daysBetween, isValidDate, monthOf, todayIn } from "@/lib/dates";
import { formatMonth } from "@/lib/format";
import { DOC_KINDS, defaultDocTitle, isDocKind, renewalKind, type DocKind } from "./doc-names";

/**
 * A vehicle's papers by category (issue #187, C138): the Documents tab shows every paper of a vehicle in
 * one place, the files uploaded on the tab and the files on its renewals, grouped by what they are
 * (registration book, revenue license, emission test, insurance, other).
 *
 * For the kinds that run out (revenue license, emission test, insurance) the Renewals tab owns the record:
 * the current paper, its days left and the earlier papers come only from renewals. A Documents upload of
 * one of those kinds is shown in its category as a paper "on file", never as the current one, and never
 * changes the days. The gaps between renewals are worked out from their dates.
 *
 * Pure: plain values in and out, no database, clock or FormData, so it is easy to test. The database has
 * no "kind" column: a Documents upload's kind and date come from the name the hub gave it
 * (`PLATE_kind_date.ext`, C134), or for older files from clear words in its title or name.
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
  /** True for a renewal that has been renewed (history). */
  renewed: boolean;
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
  /**
   * The paper in force: for a kind that runs out, the current renewal (never one already renewed); for a book, the newest book. Null
   * when there is none, and always for "Other", whose papers are not versions of one another.
   */
  current: Paper | null;
  /** Earlier papers of the same record, newest first: earlier renewals, or earlier books. */
  earlier: Paper[];
  /** `earlier` with the gaps between renewals put in, newest first. */
  timeline: TimelineEntry[];
  /** Papers simply on file: Documents uploads of a kind that runs out, or every "Other" paper. Newest first. */
  onFile: Paper[];
  status: PaperStatus;
};

/** Kinds that run out: their papers have a "valid until" and a days-left count, owned by the Renewals tab. */
export const DATED_KINDS: readonly DocKind[] = ["license", "emission", "insurance"];
export const isDatedKind = (kind: DocKind) => DATED_KINDS.includes(kind);

/** A break of up to this many days with nothing valid is a late renewal; a longer one is a gap. */
export const GAP_MIN_DAYS = 31;

/** "Renew" shows from this many days before the end, and while it is overdue. The same rule everywhere. */
export const RENEW_WITHIN_DAYS = 30;

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

/**
 * For files named before C134: the kind from clear words in the title or file name ("revenue license",
 * "registration book", "insurance", "emission"). Anything less clear is "Other": a driving licence, a
 * photo of the license plate or a book of accounts is not a vehicle paper of those kinds.
 */
export function guessKind(text: string): DocKind {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  if (/ insurance /.test(t)) return "insurance";
  if (/ emission /.test(t)) return "emission";
  if (/ revenue licen[cs]e /.test(t)) return "license";
  if (/ registration book /.test(t)) return "book";
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
    renewed: false,
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
    renewed: r.renewedAt !== null,
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
 * that renewal instead of showing twice (the newest such renewal when two share the date).
 */
export function buildPapers(input: {
  renewals: readonly RenewalLike[];
  renewalFiles: ReadonlyMap<string, readonly PaperFile[]>;
  documents: readonly PaperFile[];
}): Paper[] {
  const papers = input.renewals.map((r) => paperFromRenewal(r, input.renewalFiles.get(r.id) ?? []));
  for (const file of input.documents) {
    const doc = paperFromDocument(file);
    const twins = doc.until ? papers.filter((p) => p.renewalId && p.kind === doc.kind && p.until === doc.until) : [];
    const twin = twins.sort(currentFirst)[0];
    if (twin) twin.files = [...twin.files, file].sort(byOldest);
    else papers.push(doc);
  }
  return papers;
}

/**
 * The day a paper is placed by: its valid-until or its date, else the calendar day it was added in the app
 * time zone (so an undated paper never sorts last by accident).
 */
function sortDay(p: Paper): string {
  return p.until ?? p.dated ?? todayIn(appConfig.timeZone, p.addedAt);
}

/** Newest first: by the day that counts for the paper, then the one entered last. */
function newestFirst(a: Paper, b: Paper): number {
  const da = sortDay(a);
  const db = sortDay(b);
  if (da !== db) return da < db ? 1 : -1;
  return b.addedAt.getTime() - a.addedAt.getTime();
}

/** The renewal in force first: latest valid-until, then one not yet renewed, then the one entered last (as the Renewals tab, C46). */
function currentFirst(a: Paper, b: Paper): number {
  const da = a.until ?? "";
  const db = b.until ?? "";
  if (da !== db) return da < db ? 1 : -1;
  if (a.renewed !== b.renewed) return a.renewed ? 1 : -1;
  return b.addedAt.getTime() - a.addedAt.getTime();
}

/**
 * The gap between a newer paper and the one before it: the days with nothing valid, from the day after the
 * older one ends to the day before the newer one starts, when that is more than GAP_MIN_DAYS. Overlapping
 * papers, or a newer one whose start is not known, have no gap.
 */
export function gapBetween(newer: Paper, older: Paper): { from: string; to: string } | null {
  if (!newer.start || !older.until) return null;
  const missing = daysBetween(older.until, newer.start) - 1;
  if (missing <= GAP_MIN_DAYS) return null;
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

/** Whether "Renew" shows: within RENEW_WITHIN_DAYS of the end, or overdue. */
export function renewDue(days: number | null): boolean {
  return days !== null && days <= RENEW_WITHIN_DAYS;
}

/** "81 days left", "1 day left", "Ends today", "3 days late": the one wording for a paper's days, everywhere. */
export function daysWords(days: number): string {
  if (days === 0) return "Ends today";
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} late`;
  return `${days} day${days === 1 ? "" : "s"} left`;
}

const plain = (papers: Paper[]) => papers.map((paper) => ({ type: "paper" as const, paper }));

/** One group per kind, in the fixed order of DOC_KINDS (the at-a-glance row). */
export function groupPapers(papers: readonly Paper[], today: string): PaperGroup[] {
  return DOC_KINDS.map(({ key: kind, label }) => {
    const mine = papers.filter((p) => p.kind === kind);
    if (kind === "other") {
      const onFile = [...mine].sort(newestFirst);
      return { kind, label, current: null, earlier: [], timeline: [], onFile, status: onFile.length ? { tone: "file" as const, count: onFile.length } : { tone: "none" as const } };
    }
    if (isDatedKind(kind)) {
      // Only renewals make the current paper and the days, and only one not yet renewed (C46, as the
      // Renewals tab: renewing A and then deleting the new B leaves nothing current, A under earlier).
      // Uploads of this kind are simply on file.
      const renewals = mine.filter((p) => p.renewalId);
      const [current = null, ...otherActive] = renewals.filter((p) => !p.renewed).sort(currentFirst);
      const earlier = [...otherActive, ...renewals.filter((p) => p.renewed)].sort(newestFirst);
      const onFile = mine.filter((p) => !p.renewalId).sort(newestFirst);
      let status: PaperStatus = { tone: "none" };
      if (current?.until) {
        const days = daysBetween(today, current.until);
        status = { tone: toneOfDays(days), days };
      } else if (onFile.length || earlier.length) {
        status = { tone: "file", count: onFile.length + earlier.length };
      }
      return { kind, label, current, earlier, timeline: timelineOf(current, earlier), onFile, status };
    }
    // The registration book: the newest is current, earlier ones (a re-issued book) underneath.
    const [current = null, ...earlier] = [...mine].sort(newestFirst);
    return { kind, label, current, earlier, timeline: plain(earlier), onFile: [], status: current ? { tone: "file" as const, count: mine.length } : { tone: "none" as const } };
  });
}

/** The categories that get an at-a-glance tile: those with something in them, in the usual order (a category with nothing gets none, and the add row below the sections takes over). */
export function glanceGroups(groups: readonly PaperGroup[]): PaperGroup[] {
  return groups.filter((g) => g.status.tone !== "none");
}

/**
 * The paper a category's tile opens: the current one (the one the tile's days are about); with no current
 * paper, the newest of the others on file (preferring one that has a file to show). Null for an empty category.
 * The tile opens the viewer only when this paper has a file; otherwise it jumps to the category's section.
 */
export function glanceTarget(g: PaperGroup): Paper | null {
  if (g.current) return g.current;
  const rest = [...g.onFile, ...g.earlier].sort(newestFirst);
  return rest.find((p) => p.files.length > 0) ?? rest[0] ?? null;
}

/**
 * The short line under a tile's title, only ever real information: the days left for a paper that runs
 * out (with the colour of its state), else the book's printed month, when the newest paper ends or ended,
 * or how many papers there are; plus "no scan" when the paper the tile is about has no file yet. Null when
 * there is nothing real to say (a book without a known date, with its scan). Also what the phone's cards and
 * chips say, so "On file" never stands alone as a label.
 */
export function glanceLabel(g: PaperGroup, today: string): { text: string; tone: "ok" | "soon" | "overdue" | null } | null {
  const s = g.status;
  if (s.tone === "none") return null;
  const target = glanceTarget(g);
  const noScan = target !== null && target.files.length === 0;
  const withScan = (text: string | null) => (noScan ? (text ? `${text} · no scan` : "No scan") : text);
  if (s.tone !== "file") {
    return { text: withScan(daysWords(s.days))!, tone: s.tone };
  }
  const count = s.count === 1 ? "1 paper" : `${s.count} papers`;
  let text: string | null;
  if (g.kind === "other") {
    text = count;
  } else if (g.kind === "book") {
    text = target?.dated ? formatMonth(monthOf(target.dated)) : s.count > 1 ? `${s.count} books` : null;
  } else {
    // A kind that runs out, with no current renewal: when the newest paper ends or ended.
    text = target?.until ? `${target.until < today ? "Ended" : "Until"} ${formatMonth(monthOf(target.until))}` : count;
  }
  text = withScan(text);
  return text ? { text, tone: null } : null;
}

/**
 * What a tile does: "viewer" opens the paper it is about; "section" jumps to the category's section, for a
 * paper with no scan yet (a renewal waiting for its scan, where "Add the scan" is); null for an empty category.
 */
export function glanceOpens(g: PaperGroup): "viewer" | "section" | null {
  const target = glanceTarget(g);
  if (!target) return null;
  return target.files.length > 0 ? "viewer" : "section";
}

/**
 * Most urgent first: papers that run out, soonest (or longest expired) first; then the book and papers of
 * those kinds that are only on file; then other papers; then the categories with nothing in them, in their
 * usual order.
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

/**
 * Papers whose name, kind, dates or file names contain every word of `query` (any case), newest first.
 * `shownDates` adds the dates as the screen writes them ("May 1, 2027", "May 2027"), so they match too.
 */
export function searchPapers(papers: readonly Paper[], query: string, shownDates: (day: string) => string = () => ""): Paper[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return papers
    .filter((p) => {
      const days = [p.start, p.until, p.dated].filter((d): d is string => Boolean(d));
      const haystack = [p.name, kindLabel(p.kind), ...days, ...days.map(shownDates), ...p.files.flatMap((f) => [f.fileName, f.title])].filter(Boolean).join(" ").toLowerCase();
      return words.every((w) => haystack.includes(w));
    })
    .sort(newestFirst);
}
