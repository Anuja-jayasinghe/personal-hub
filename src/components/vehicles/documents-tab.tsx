import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { DaysRing } from "@/components/shared/days-ring";
import { buttonVariants } from "@/components/ui/button";
import { PaperArt } from "@/components/vehicles/paper-art";
import { PaperViewer, type RenewProps } from "@/components/vehicles/paper-viewer";
import { AddDocumentSheet, AddScanSheet, RenewSheet } from "@/components/vehicles/vehicle-sheets";
import { appConfig } from "@/config/app.config";
import type { Attachment, VehicleRenewal } from "@/db/schema";
import { attachmentsByOwner } from "@/features/shared/queries";
import { docFileName, renewalKind, type DocKind } from "@/features/vehicles/doc-names";
import {
  buildPapers,
  byUrgency,
  groupPapers,
  kindLabel,
  searchPapers,
  type Paper,
  type PaperFile,
  type PaperGroup,
  type PaperStatus,
} from "@/features/vehicles/papers";
import { listRenewals } from "@/features/vehicles/queries";
import { isDemo } from "@/lib/auth";
import { daysBetween, monthOf } from "@/lib/dates";
import { formatBytes, formatDate, formatMoney, formatMonth, todayInAppTz } from "@/lib/format";

/**
 * A vehicle's papers by category (issue #187, C138; design canvas "Documents by category"). Every paper of
 * the vehicle is here: the files uploaded on this tab and the files on its renewals, so nothing has to be
 * looked for in two places. An at-a-glance row (desktop) or category chips (phone) show each category's
 * state; the categories follow, most urgent first, each with its current paper and the earlier ones folded
 * underneath (with the gaps between them). A paper opens in an on-page viewer.
 *
 * The renewal records stay owned by the Renewals tab (one home per action, C102): "Renew" here opens that
 * tab's own form. Adding needs Add in Vehicle documents, replacing and deleting need Edit there (C114),
 * renewing needs Edit in Vehicles, the same as the actions check. Use inside <Suspense>.
 */

export type DocumentsAccess = { canAdd: boolean; canEdit: boolean; canRenew: boolean };

type Ctx = {
  vehicleId: string;
  vehicleName: string;
  namePrefix: string;
  today: string;
  sample: boolean;
  access: DocumentsAccess;
  renewals: Map<string, VehicleRenewal>;
  types: readonly string[];
  askOdometer: boolean;
  /** The tab's own address, for the chips and the category view. */
  href: (kind?: DocKind) => string;
};

const TONE_TEXT = { ok: "text-status-ok", soon: "text-status-soon", overdue: "text-status-overdue" } as const;
const TONE_EDGE = { ok: "border-border", soon: "border-status-soon-mark/45", overdue: "border-status-overdue/50" } as const;
const TONE_DOT = { ok: "bg-status-ok", soon: "bg-status-soon-mark", overdue: "bg-status-overdue" } as const;

function toFile(a: Attachment): PaperFile {
  return { id: a.id, ownerType: a.ownerType, ownerId: a.ownerId, fileName: a.fileName, title: a.title, mimeType: a.mimeType, sizeBytes: a.sizeBytes, createdAt: a.createdAt };
}

export async function DocumentsTab({
  vehicleId,
  vehicleName,
  namePrefix,
  coverAttachmentId,
  query,
  kind,
  access,
  askOdometer,
  basePath,
}: {
  vehicleId: string;
  vehicleName: string;
  /** The vehicle part of document file names (issue #179), for the upload forms' preview. */
  namePrefix: string;
  coverAttachmentId: string | null;
  query: string;
  /** The category to show on its own (`?kind=`), if any. */
  kind: DocKind | null;
  access: DocumentsAccess;
  /** False when the vehicle's emission certificates print an inaccurate odometer (issue #184); for the renew form. */
  askOdometer: boolean;
  /** The vehicle's address, e.g. "/vehicles/CAB-1234". */
  basePath: string;
}) {
  const [own, renewalRows] = await Promise.all([attachmentsByOwner("vehicle", [vehicleId]), listRenewals(vehicleId)]);
  const renewalFiles = await attachmentsByOwner("vehicle_renewal", renewalRows.map((r) => r.id));
  const sample = await isDemo();
  const today = todayInAppTz(); // after the queries, which opt this render into request time

  const documents = (own.get(vehicleId) ?? []).filter((a) => a.id !== coverAttachmentId).map(toFile);
  const papers = buildPapers({
    renewals: renewalRows,
    renewalFiles: new Map([...renewalFiles].map(([id, list]) => [id, list.map(toFile)])),
    documents,
  });
  const groups = groupPapers(papers, today);
  const ctx: Ctx = {
    vehicleId,
    vehicleName,
    namePrefix,
    today,
    sample,
    access,
    // The reference number has not been used since C137; it never goes to the browser.
    renewals: new Map(renewalRows.map((r) => [r.id, { ...r, referenceNumber: null }])),
    types: appConfig.vehicles.renewalTypes.map((t) => t.label),
    askOdometer,
    href: (k) => `${basePath}?tab=documents${k ? `&kind=${k}` : ""}`,
  };
  const searching = query.trim() !== "";
  const selected = kind ? groups.find((g) => g.kind === kind) : undefined;

  return (
    <section aria-label="Documents" className="flex flex-col gap-6">
      {!selected && (papers.length > 2 || access.canAdd) ? (
        <div className="flex flex-wrap items-center gap-3">
          {papers.length > 2 ? (
            <form method="get" action={basePath} className="flex min-w-0 flex-1 items-center gap-2">
              <input type="hidden" name="tab" value="documents" />
              <label className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl border bg-deepest px-3.5 text-label focus-within:border-primary">
                <Search aria-hidden className="size-4 shrink-0" />
                <input
                  type="search"
                  name="q"
                  defaultValue={query}
                  placeholder={`Search ${vehicleName}’s papers`}
                  aria-label={`Search ${vehicleName}’s papers`}
                  className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-label"
                />
              </label>
              {searching ? (
                <Link href={ctx.href()} className="shrink-0 text-sm text-muted-foreground underline-offset-2 hover:underline">
                  Clear
                </Link>
              ) : null}
            </form>
          ) : (
            <span className="flex-1" />
          )}
          {access.canAdd ? <AddDocumentSheet vehicleId={vehicleId} vehicleName={vehicleName} namePrefix={namePrefix} /> : null}
        </div>
      ) : null}

      {searching ? (
        <SearchResults ctx={ctx} query={query} found={searchPapers(papers, query)} groups={groups} />
      ) : selected ? (
        <CategoryView ctx={ctx} group={selected} groups={groups} />
      ) : (
        <AllPapers ctx={ctx} groups={groups} />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Words for dates and status
// ---------------------------------------------------------------------------------------------

/** "13 Feb 2026 – 12 Feb 2027", or "Until 12 Feb 2027" when the start is not known. */
function rangeText(p: Paper): string | null {
  if (p.until) return p.start ? `${formatDate(p.start)} – ${formatDate(p.until)}` : `Until ${formatDate(p.until)}`;
  if (p.dated) return `${p.kind === "book" ? "Printed" : "Dated"} ${formatDate(p.dated)}`;
  return null;
}

/** The same in months, for the timeline: "Feb 2025 – Feb 2026". */
function monthRange(p: Paper): string {
  if (p.until) return p.start ? `${formatMonth(monthOf(p.start))} – ${formatMonth(monthOf(p.until))}` : `Until ${formatMonth(monthOf(p.until))}`;
  if (p.dated) return `${p.kind === "book" ? "Printed" : "Dated"} ${formatDate(p.dated)}`;
  return `Added ${formatDate(p.addedAt)}`;
}

/** What a paper is called on a card: its name, else its dates. */
function headline(p: Paper): string {
  return p.name ?? rangeText(p) ?? kindLabel(p.kind);
}

/** The line under the headline: the dates when the headline is a name, and the amount paid. */
function subline(p: Paper): string {
  return [p.name ? rangeText(p) : null, p.amount !== null ? formatMoney(Number(p.amount)) : null].filter(Boolean).join(" · ");
}

function fileLine(p: Paper): string {
  const [first, ...more] = p.files;
  if (!first) return "No scan yet";
  return [first.fileName + (more.length ? ` +${more.length}` : ""), formatBytes(p.files.reduce((n, f) => n + f.sizeBytes, 0))].join(" · ");
}

/** The short state of a category, in capitals for the mono labels. */
function statusWords(g: PaperGroup): string {
  const s = g.status;
  if (s.tone === "none") return "Nothing yet";
  if (s.tone === "file") return g.kind === "other" ? `${s.count} on file` : "On file";
  if (s.days < 0) return `${-s.days} day${s.days === -1 ? "" : "s"} late`;
  if (s.days === 0) return "Ends today";
  return `${s.days} day${s.days === 1 ? "" : "s"} left`;
}

const toneOf = (s: PaperStatus) => (s.tone === "ok" || s.tone === "soon" || s.tone === "overdue" ? s.tone : null);
const plural = (g: PaperGroup, n: number) => {
  const noun = { book: "book", license: "license", emission: "test", insurance: "policy", other: "paper" }[g.kind];
  return `${n} earlier ${n === 1 ? noun : noun === "policy" ? "policies" : `${noun}s`}`;
};

/** The renew form's data, when "Renew" applies to this paper and person. */
function renewFor(ctx: Ctx, p: Paper, isCurrent: boolean): RenewProps | null {
  if (!ctx.access.canRenew || !isCurrent || !p.renewalId) return null;
  const renewal = ctx.renewals.get(p.renewalId);
  if (!renewal || renewal.renewedAt) return null;
  return { renewal, vehicleName: ctx.vehicleName, types: ctx.types, askOdometer: ctx.askOdometer };
}

// ---------------------------------------------------------------------------------------------
// The whole tab: at a glance, then the categories, most urgent first
// ---------------------------------------------------------------------------------------------

function AllPapers({ ctx, groups }: { ctx: Ctx; groups: PaperGroup[] }) {
  const ordered = byUrgency(groups);
  const shown = ordered.filter((g) => g.status.tone !== "none");
  const empty = ordered.filter((g) => g.status.tone === "none");
  const nothing = shown.length === 0;

  return (
    <>
      <Chips ctx={ctx} groups={groups} current={null} />

      {/* Phone: compact cards, each opening its category. */}
      <div className="flex flex-col gap-2.5 md:hidden">
        {shown.map((g) => (
          <CompactCard key={g.kind} ctx={ctx} group={g} />
        ))}
        {empty.length > 0 && ctx.access.canAdd ? <EmptyRow ctx={ctx} groups={empty} /> : null}
        {nothing && !ctx.access.canAdd ? <NothingYet /> : null}
      </div>

      {/* Desktop: the at-a-glance row, then each category in full. */}
      <div className="hidden flex-col gap-7 md:flex">
        <nav aria-label="At a glance" className="grid grid-cols-5 gap-3">
          {groups.map((g) => (
            <GlanceTile key={g.kind} group={g} href={g.status.tone === "none" ? ctx.href(g.kind) : `#doc-${g.kind}`} />
          ))}
        </nav>
        {nothing && !ctx.access.canAdd ? <NothingYet /> : null}
        <div className="@container">
          <div className="grid gap-x-5 gap-y-7 @5xl:grid-cols-2">
            {shown.map((g, i) => (
              <CategorySection key={g.kind} ctx={ctx} group={g} wide={i === 0 || g.earlier.length > 0 || toneOf(g.status) === "soon" || toneOf(g.status) === "overdue"} />
            ))}
          </div>
        </div>
        {empty.length > 0 && ctx.access.canAdd ? <EmptyRow ctx={ctx} groups={empty} /> : null}
      </div>
    </>
  );
}

function NothingYet() {
  return <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">No papers yet.</p>;
}

/** Phone: All plus one chip per category; a category that runs out soon carries its state colour. */
function Chips({ ctx, groups, current }: { ctx: Ctx; groups: PaperGroup[]; current: DocKind | null }) {
  const chip = (selected: boolean) =>
    `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] transition-colors ${
      selected ? "bg-accent font-semibold text-foreground ring-1 ring-primary/50" : "text-muted-foreground ring-1 ring-border hover:text-foreground"
    }`;
  const short: Record<DocKind, string> = { book: "Book", license: "License", emission: "Emission", insurance: "Insurance", other: "Other" };
  return (
    <nav aria-label="Categories" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 md:hidden">
      <Link href={ctx.href()} aria-current={current === null ? "page" : undefined} className={chip(current === null)}>
        All
      </Link>
      {byUrgency(groups).map((g) => {
        const tone = toneOf(g.status);
        return (
          <Link key={g.kind} href={ctx.href(g.kind)} aria-current={current === g.kind ? "page" : undefined} aria-label={`${g.label}: ${statusWords(g).toLowerCase()}`} className={chip(current === g.kind)}>
            {tone && tone !== "ok" ? <span aria-hidden className={`size-2 rounded-full ${TONE_DOT[tone]}`} /> : null}
            {short[g.kind]}
          </Link>
        );
      })}
    </nav>
  );
}

function GlanceTile({ group: g, href }: { group: PaperGroup; href: string }) {
  const tone = toneOf(g.status);
  const empty = g.status.tone === "none";
  const art = g.current ?? g.earlier[0];
  return (
    <a
      href={href}
      className={`flex min-w-0 items-center gap-3 rounded-2xl border p-3.5 transition-colors hover:border-quiet ${empty ? "border-dashed bg-transparent" : `bg-card ${tone ? TONE_EDGE[tone] : ""}`}`}
    >
      <span className="flex h-9 w-10 shrink-0 items-center justify-center">
        {art ? <PaperArt kind={g.kind} size="xs" /> : <span aria-hidden className="h-9 w-7 rounded-[3px] border border-dashed border-quiet" />}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold">{g.label}</span>
        <span className={`font-mono text-[11px] tracking-[0.06em] uppercase ${tone ? TONE_TEXT[tone] : "text-label"}`}>{statusWords(g)}</span>
      </span>
    </a>
  );
}

/** One category in full (desktop): its current paper as a card, earlier ones folded underneath. */
function CategorySection({ ctx, group: g, wide }: { ctx: Ctx; group: PaperGroup; wide: boolean }) {
  const meta =
    g.kind === "other"
      ? null
      : g.kind === "book"
        ? g.earlier.length
          ? `No expiry · ${g.earlier.length} earlier`
          : "No expiry"
        : g.earlier.length
          ? `Current · ${g.earlier.length} earlier`
          : "Current · no history yet";
  return (
    <section id={`doc-${g.kind}`} aria-labelledby={`doc-${g.kind}-title`} className={`flex scroll-mt-6 flex-col gap-3 ${wide ? "@5xl:col-span-2" : ""}`}>
      <div className="flex items-baseline gap-2.5">
        <h2 id={`doc-${g.kind}-title`} className="font-display text-xl font-semibold tracking-tight">
          <Link href={ctx.href(g.kind)} className="underline-offset-4 hover:underline">
            {g.label}
          </Link>
        </h2>
        {meta ? <span className="font-mono text-[11px] tracking-[0.08em] text-label uppercase">{meta}</span> : null}
        <span className="flex-1" />
        {ctx.access.canAdd ? <AddDocumentSheet vehicleId={ctx.vehicleId} vehicleName={ctx.vehicleName} namePrefix={ctx.namePrefix} kind={g.kind} label="Add" variant="outline" /> : null}
      </div>

      {g.current ? (
        <article className={`overflow-hidden rounded-[20px] border bg-card ${TONE_EDGE[toneOf(g.status) ?? "ok"]}`}>
          <CurrentCard ctx={ctx} group={g} paper={g.current} />
          {g.earlier.length > 0 ? (
            <details className="group border-t">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-[18px] py-3 text-[13px] text-label hover:text-foreground [&::-webkit-details-marker]:hidden">
                <ChevronRight aria-hidden className="size-4 transition-transform group-open:rotate-90" />
                {plural(g, g.earlier.length)}
              </summary>
              <div className="px-[18px] pb-4">
                <Timeline ctx={ctx} group={g} />
              </div>
            </details>
          ) : null}
        </article>
      ) : (
        <ul className="grid gap-2.5 @2xl:grid-cols-2 @5xl:grid-cols-3">
          {g.earlier.map((p) => (
            <li key={p.key}>
              <PaperTile ctx={ctx} paper={p} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The current paper: its drawing, what it is, its dates and file, the days-left ring and the actions. */
function CurrentCard({ ctx, group: g, paper: p }: { ctx: Ctx; group: PaperGroup; paper: Paper }) {
  const days = "days" in g.status ? g.status.days : null;
  const renew = renewFor(ctx, p, true);
  const sub = subline(p);
  return (
    <div className="flex items-center gap-5 p-[18px]">
      <PaperArt kind={g.kind} size="md" month={p.until?.slice(0, 7)} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate text-[17px] font-semibold">{headline(p)}</span>
        {sub ? <span className="text-sm text-muted-foreground">{sub}</span> : null}
        <span className={`truncate font-mono text-[11.5px] ${p.files.length ? "text-label" : "text-status-soon"}`}>{fileLine(p)}</span>
      </div>
      {days !== null ? (
        <DaysRing days={days} ofDays={p.start && p.until ? Math.max(1, daysBetween(p.start, p.until)) : 365} size={72} label={`${g.label}: ${days < 0 ? `${-days} days late` : `${days} days left`}`} />
      ) : null}
      <div className="flex shrink-0 flex-col gap-2">
        <OpenOrAdd ctx={ctx} paper={p} isCurrent label="View" />
        {renew && days !== null && days <= 30 ? <RenewSheet {...renew} /> : null}
      </div>
    </div>
  );
}

/** "View" for a paper with a file; for a renewal with none yet, adding its scan (for people who may add). */
function OpenOrAdd({ ctx, paper: p, isCurrent, label, primary = false }: { ctx: Ctx; paper: Paper; isCurrent: boolean; label: string; primary?: boolean }) {
  if (p.files.length === 0) {
    if (!p.renewalId || !ctx.access.canAdd) return null;
    const renewal = ctx.renewals.get(p.renewalId);
    if (!renewal) return null;
    return <AddScanSheet renewalId={renewal.id} renewalType={renewal.type} vehicleName={ctx.vehicleName} nameHint={docFileName({ vehicle: ctx.namePrefix, kind: renewalKind(renewal.type), date: renewal.expiryDate, ext: "pdf" })} />;
  }
  return (
    <PaperViewer
      paper={p}
      isCurrent={isCurrent}
      today={ctx.today}
      sample={ctx.sample}
      canEdit={ctx.access.canEdit}
      renew={renewFor(ctx, p, isCurrent)}
      ariaLabel={`View ${kindLabel(p.kind).toLowerCase()}${p.name ? `, ${p.name}` : ""}`}
      className={`${buttonVariants({ variant: primary ? "default" : "outline", size: primary ? "lg" : "default" })} ${primary ? "flex-1" : "border-primary/60 text-primary hover:text-primary"}`}
    >
      {label}
    </PaperViewer>
  );
}

/** A small card for one paper that opens it in the viewer (other papers, search results, earlier papers). */
function PaperTile({ ctx, paper: p, isCurrent = false, faded = false }: { ctx: Ctx; paper: Paper; isCurrent?: boolean; faded?: boolean }) {
  const inner = (
    <>
      <span className="flex h-10 w-12 shrink-0 items-center justify-center">
        <PaperArt kind={p.kind} size="xs" faded={faded} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 text-left">
        <span className="truncate text-[13.5px] font-medium">{p.kind === "other" ? (p.name ?? "Paper") : monthRange(p)}</span>
        <span className="truncate font-mono text-[10.5px] text-label">
          {p.kind === "other"
            ? [p.dated ? formatDate(p.dated) : null, p.files.length ? null : "no scan"].filter(Boolean).join(" · ") || formatDate(p.addedAt)
            : [p.amount !== null ? formatMoney(Number(p.amount)) : null, p.name, p.files.length ? null : "no scan"].filter(Boolean).join(" · ") || kindLabel(p.kind)}
        </span>
      </span>
    </>
  );
  const box = "flex w-full min-w-0 items-center gap-3 rounded-[14px] bg-deepest p-2.5 ring-1 ring-border";
  if (p.files.length === 0) return <div className={box}>{inner}</div>;
  return (
    <PaperViewer
      paper={p}
      isCurrent={isCurrent}
      today={ctx.today}
      sample={ctx.sample}
      canEdit={ctx.access.canEdit}
      renew={renewFor(ctx, p, isCurrent)}
      ariaLabel={`View ${p.name ?? kindLabel(p.kind).toLowerCase()}, ${monthRange(p)}`}
      className={`${box} transition-colors hover:ring-quiet`}
    >
      {inner}
    </PaperViewer>
  );
}

/** Earlier papers on a line, newest first, with the stretches that had no paper shown plainly. */
function Timeline({ ctx, group: g }: { ctx: Ctx; group: PaperGroup }) {
  const what = g.kind === "license" ? "license" : g.label.toLowerCase();
  return (
    <ol className="flex max-w-3xl flex-col">
      {g.timeline.map((e, i) => {
        const last = i === g.timeline.length - 1;
        if (e.type === "gap") {
          return (
            <li key={`gap-${e.from}`} className="flex gap-3">
              <span aria-hidden className="flex w-3.5 shrink-0 flex-col items-center">
                <span className="mt-2.5 size-2.5 rounded-full border-2 border-quiet" />
                {last ? null : <span className="flex-1 border-l-2 border-dashed border-border" />}
              </span>
              <span className="flex-1 pt-1.5 pb-3.5 text-[13px] text-label">
                No {what} on file, {formatMonth(monthOf(e.from))} – {formatMonth(monthOf(e.to))}
              </span>
            </li>
          );
        }
        return (
          <li key={e.paper.key} className="flex gap-3">
            <span aria-hidden className="flex w-3.5 shrink-0 flex-col items-center">
              <span className={`mt-[22px] size-2.5 rounded-full ${e.paper.files.length ? "bg-primary" : "border-2 border-quiet"}`} />
              {last ? null : <span className="w-0.5 flex-1 bg-border" />}
            </span>
            <div className={`min-w-0 flex-1 ${last ? "" : "pb-2"}`}>
              <PaperTile ctx={ctx} paper={e.paper} faded />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Phone: one category in a compact card, opening its own view. */
function CompactCard({ ctx, group: g }: { ctx: Ctx; group: PaperGroup }) {
  const tone = toneOf(g.status);
  const p = g.current ?? g.earlier[0];
  const sub =
    g.kind === "other"
      ? (g.earlier.slice(0, 2).map((x) => x.name ?? "Paper").join(", ") + (g.earlier.length > 2 ? "…" : ""))
      : [p?.until ? `until ${formatDate(p.until)}` : p?.dated ? `printed ${formatDate(p.dated)}` : null, g.earlier.length ? `${g.earlier.length} earlier` : null, p?.name].filter(Boolean).join(" · ");
  return (
    <Link href={ctx.href(g.kind)} className={`flex items-center gap-3.5 rounded-[18px] border bg-card p-3.5 ${tone ? TONE_EDGE[tone] : ""}`}>
      <span className="flex h-12 w-[74px] shrink-0 items-center justify-center">{p ? <PaperArt kind={g.kind} size="sm" /> : null}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{g.label}</span>
        <span className="truncate text-[12.5px] text-muted-foreground">{sub}</span>
      </span>
      {"days" in g.status ? (
        <span className="flex shrink-0 flex-col items-center">
          <span className={`font-display text-[22px] leading-none font-semibold ${TONE_TEXT[tone!]}`}>{Math.abs(g.status.days)}</span>
          <span className="font-mono text-[9px] text-label">{g.status.days < 0 ? "LATE" : "DAYS"}</span>
        </span>
      ) : (
        <span className="shrink-0 font-mono text-[10px] tracking-[0.06em] text-label uppercase">{statusWords(g)}</span>
      )}
    </Link>
  );
}

/** Categories with nothing in them, in one quiet row, each with its own Add. */
function EmptyRow({ ctx, groups }: { ctx: Ctx; groups: PaperGroup[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-[18px] border border-dashed px-4 py-3.5 md:px-5">
      <span className="font-mono text-[11px] tracking-[0.08em] text-label uppercase">Nothing yet</span>
      {groups.map((g) => (
        <span key={g.kind} className="flex items-center gap-2">
          <span className="text-sm">{g.label}</span>
          <AddDocumentSheet vehicleId={ctx.vehicleId} vehicleName={ctx.vehicleName} namePrefix={ctx.namePrefix} kind={g.kind} label="Add" variant="outline" />
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// One category on its own (?kind=): the current paper large, then EARLIER as a timeline
// ---------------------------------------------------------------------------------------------

function CategoryView({ ctx, group: g, groups }: { ctx: Ctx; group: PaperGroup; groups: PaperGroup[] }) {
  const p = g.current;
  const tone = toneOf(g.status);
  const days = "days" in g.status ? g.status.days : null;
  const renew = p ? renewFor(ctx, p, true) : null;
  const sub = p ? subline(p) : "";
  return (
    <>
      <Chips ctx={ctx} groups={groups} current={g.kind} />
      <div className="flex items-center gap-2">
        <Link href={ctx.href()} aria-label="All papers" className={`${buttonVariants({ variant: "ghost", size: "icon" })} -ml-2`}>
          <ChevronLeft aria-hidden className="size-5" />
        </Link>
        <h2 className="font-display text-[22px] font-semibold tracking-tight md:text-2xl">{g.label}</h2>
        <span className="flex-1" />
        {ctx.access.canAdd ? <AddDocumentSheet vehicleId={ctx.vehicleId} vehicleName={ctx.vehicleName} namePrefix={ctx.namePrefix} kind={g.kind} label="Add" variant="outline" /> : null}
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] md:items-start">
        {p ? (
          <article className={`flex flex-col gap-3.5 rounded-[22px] border bg-card p-4 ${TONE_EDGE[tone ?? "ok"]}`}>
            <div className="flex items-center justify-center rounded-[14px] bg-[radial-gradient(80%_80%_at_50%_50%,var(--raised)_0%,var(--deepest)_80%)] py-4">
              <PaperArt kind={g.kind} size="lg" month={p.until?.slice(0, 7)} />
            </div>
            <div className="flex items-center gap-3">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{headline(p)}</span>
                {sub ? <span className="text-[13px] text-muted-foreground">{sub}</span> : null}
                <span className={`truncate font-mono text-[11px] ${p.files.length ? "text-label" : "text-status-soon"}`}>{fileLine(p)}</span>
              </span>
              {days !== null && tone ? (
                <span className="flex shrink-0 flex-col items-center" role="img" aria-label={days < 0 ? `${-days} days late` : `${days} days left`}>
                  <span className={`font-display text-2xl leading-none font-semibold ${TONE_TEXT[tone]}`}>{Math.abs(days)}</span>
                  <span className="font-mono text-[9px] text-label">{days < 0 ? "LATE" : "DAYS"}</span>
                </span>
              ) : (
                <span className="shrink-0 font-mono text-[10px] tracking-[0.06em] text-label uppercase">{statusWords(g)}</span>
              )}
            </div>
            <div className="flex gap-2.5 [&>button]:flex-1">
              <OpenOrAdd ctx={ctx} paper={p} isCurrent label="View" primary />
              {renew ? <RenewSheet {...renew} size="lg" /> : null}
            </div>
          </article>
        ) : g.kind === "other" ? null : (
          <div className="flex flex-col items-center gap-3 rounded-[22px] border border-dashed p-8 text-center">
            <span aria-hidden className="h-[72px] w-[54px] rounded-[4px] border border-dashed border-quiet" />
            <p className="text-sm text-muted-foreground">No {g.kind === "license" ? "license" : g.label.toLowerCase()} yet.</p>
          </div>
        )}

        {g.timeline.length > 0 ? (
          <section aria-label={g.kind === "other" ? g.label : `Earlier ${g.label.toLowerCase()}`} className="flex flex-col">
            <span className="pb-2.5 pl-1 font-mono text-[10.5px] tracking-[0.14em] text-label uppercase">{g.kind === "other" ? `${g.earlier.length} on file` : "Earlier"}</span>
            <Timeline ctx={ctx} group={g} />
          </section>
        ) : g.kind === "other" ? (
          <div className="flex flex-col items-center gap-3 rounded-[22px] border border-dashed p-8 text-center md:col-span-2">
            <p className="text-sm text-muted-foreground">Service invoices, warranty cards, purchase papers: nothing yet.</p>
          </div>
        ) : null}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------------------------

function SearchResults({ ctx, query, found, groups }: { ctx: Ctx; query: string; found: Paper[]; groups: PaperGroup[] }) {
  const currentKeys = new Set(groups.map((g) => g.current?.key).filter(Boolean));
  if (found.length === 0) return <p className="text-sm text-muted-foreground">No paper matches “{query}”.</p>;
  return (
    <section aria-label="Search results" className="flex flex-col gap-3">
      <span className="font-mono text-[11px] tracking-[0.08em] text-label uppercase">
        {found.length === 1 ? "1 paper matches" : `${found.length} papers match`}
      </span>
      <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {found.map((p) => (
          <li key={p.key} className="flex flex-col gap-1">
            <span className="pl-1 font-mono text-[10px] tracking-[0.1em] text-label uppercase">{kindLabel(p.kind)}</span>
            <PaperTile ctx={ctx} paper={p} isCurrent={currentKeys.has(p.key)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

