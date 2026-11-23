"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ChevronLeft, ExternalLink, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PopoverButton } from "@/components/electricity/popover-button";
import { SubmitButton } from "@/components/shared/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { DocumentRenameForm, ReplaceFileForm } from "@/components/vehicles/document-forms";
import { PaperArt } from "@/components/vehicles/paper-art";
import { RenewSheet } from "@/components/vehicles/vehicle-sheets";
import type { VehicleRenewal } from "@/db/schema";
import { deleteAttachment } from "@/features/shared/actions";
import { kindLabel, toneOfDays, type Paper, type PaperFile } from "@/features/vehicles/papers";
import { daysBetween } from "@/lib/dates";
import { formatBytes, formatDate, formatMoney } from "@/lib/format";

/**
 * The on-page viewer for one paper (issue #187, C138; design canvas "Viewing a paper"): the file itself
 * (an image, or the PDF embedded) from the private /files/<id> route, and a side panel with its dates,
 * the file's name, size and the day it was added. Actions: the main one ("Renew", for the current paper
 * of a renewal), Download, and a ⋯ menu with replace, rename and delete for people who may edit Vehicle
 * documents. A renewal scanned in more than one file shows them as thumbnails; nothing else is a "page"
 * the hub can know about, so nothing else gets one. In the demo there are no real files, so it shows the
 * paper's drawing instead.
 */

export type RenewProps = { renewal: VehicleRenewal; vehicleName: string; types: readonly string[]; askOdometer: boolean };

const TONE_TEXT = { ok: "text-status-ok", soon: "text-status-soon", overdue: "text-status-overdue" } as const;
const TONE_BOX = {
  ok: "border-status-ok/40 bg-status-ok-soft",
  soon: "border-status-soon-mark/45 bg-status-soon-soft",
  overdue: "border-status-overdue/45 bg-status-overdue-soft",
} as const;

const isImage = (f: PaperFile) => f.mimeType.startsWith("image/");
const isPdf = (f: PaperFile) => f.mimeType === "application/pdf";

export function PaperViewer({
  paper,
  isCurrent,
  today,
  sample,
  canEdit,
  renew,
  className,
  ariaLabel,
  children,
}: {
  paper: Paper;
  isCurrent: boolean;
  today: string;
  /** The demo: there are no real files behind the sample papers. */
  sample: boolean;
  canEdit: boolean;
  /** Set when "Renew" applies: the current paper of a renewal, for someone who may edit Vehicles. */
  renew: RenewProps | null;
  className: string;
  ariaLabel: string;
  /** What the button that opens the viewer shows. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  /** Set when the paper is going away (deleted or replaced): focus then returns to the Documents tab, not the old button. */
  const leaving = useRef(false);
  const file = paper.files[Math.min(index, paper.files.length - 1)];
  const fileId = file?.id;
  const pdf = file ? isPdf(file) : false;

  // An iframe gives no sign when the file behind it cannot be had, so ask the private route first (without
  // following its redirect to storage): a refusal or a missing file shows the fallback instead.
  useEffect(() => {
    if (!open || sample || !pdf || !fileId) return;
    let live = true;
    fetch(`/files/${fileId}`, { redirect: "manual", cache: "no-store" })
      .then((res) => {
        if (live && res.type !== "opaqueredirect" && !res.ok) setFailed(fileId);
      })
      .catch(() => {
        if (live) setFailed(fileId);
      });
    return () => {
      live = false;
    };
  }, [open, sample, pdf, fileId]);

  if (!file) return null;

  const label = kindLabel(paper.kind);
  const title = paper.name ?? label;
  const days = isCurrent && paper.until ? daysBetween(today, paper.until) : null;
  const tone = days === null ? null : toneOfDays(days);
  const goAway = () => {
    leaving.current = true;
    setOpen(false);
  };
  const choose = (i: number) => {
    setIndex(i);
    setZoom(1);
    setFailed(null);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger ref={triggerRef} className={className} aria-label={ariaLabel}>
        {children}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-[rgb(5_7_11/0.66)] transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          finalFocus={() => {
            const back = leaving.current || !triggerRef.current?.isConnected ? document.getElementById("vehicle-documents") : triggerRef.current;
            leaving.current = false;
            return back ?? true;
          }}
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background text-foreground shadow-[0_24px_40px_-16px_rgb(0_0_0/0.7)] transition duration-200 outline-none data-ending-style:opacity-0 data-starting-style:opacity-0 md:inset-6 md:flex-row md:overflow-hidden md:rounded-3xl md:border lg:inset-10">
          <div className="flex min-w-0 shrink-0 flex-col md:min-h-0 md:flex-1 md:shrink">
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background px-3 py-2.5 md:static md:px-4">
              <Dialog.Close className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Back to documents">
                <ChevronLeft aria-hidden className="size-5" />
              </Dialog.Close>
              <span className="font-mono text-[11px] tracking-[0.12em] text-label uppercase">
                {paper.files.length > 1 ? `File ${index + 1} of ${paper.files.length} · ` : ""}
                {isPdf(file) ? "PDF" : "Photo"}
              </span>
              <span className="flex-1" />
              {!sample && isImage(file) && !failed ? (
                <>
                  <button type="button" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} disabled={zoom <= 1} aria-label="Zoom out" className={buttonVariants({ variant: "outline", size: "icon" })}>
                    <Minus aria-hidden />
                  </button>
                  <span className="w-12 text-center font-mono text-xs text-muted-foreground" aria-live="polite">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button type="button" onClick={() => setZoom((z) => Math.min(4, z + 0.5))} disabled={zoom >= 4} aria-label="Zoom in" className={buttonVariants({ variant: "outline", size: "icon" })}>
                    <Plus aria-hidden />
                  </button>
                </>
              ) : null}
              {!sample && isPdf(file) ? (
                <a href={`/files/${file.id}`} target="_blank" rel="noreferrer" aria-label="Open in a new tab" className={buttonVariants({ variant: "ghost", size: "icon" })}>
                  <ExternalLink aria-hidden />
                </a>
              ) : null}
            </div>

            <div className="relative flex min-h-[52svh] flex-1 items-center justify-center overflow-auto bg-[radial-gradient(80%_70%_at_50%_50%,var(--card)_0%,var(--deepest)_75%)] md:min-h-0">
              {sample ? (
                <figure className="flex flex-col items-center gap-4 p-6">
                  <div className="origin-center scale-125 md:scale-150">
                    <PaperArt kind={paper.kind} size="lg" month={paper.until?.slice(0, 7)} />
                  </div>
                  <figcaption className="mt-8 font-mono text-[11px] tracking-[0.12em] text-label uppercase">Sample · the demo has no real files</figcaption>
                </figure>
              ) : failed === file.id ? (
                <div className="flex flex-col items-center gap-3 p-6 text-center">
                  <PaperArt kind={paper.kind} size="lg" month={paper.until?.slice(0, 7)} faded />
                  <p className="max-w-xs text-sm text-muted-foreground">This file can’t be shown here.</p>
                  <a href={`/files/${file.id}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
                    Open in a new tab
                  </a>
                </div>
              ) : isImage(file) ? (
                <div className="flex h-full w-full items-center justify-center p-4 md:p-8">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a private file behind a signed redirect, not a static asset */}
                  <img
                    key={file.id}
                    src={`/files/${file.id}`}
                    alt={`${label}: ${file.fileName}`}
                    onError={() => setFailed(file.id)}
                    style={{ transform: `scale(${zoom})` }}
                    className="max-h-full max-w-full origin-center rounded-lg object-contain shadow-[0_24px_60px_rgb(0_0_0/0.55)] transition-transform"
                  />
                </div>
              ) : isPdf(file) ? (
                <iframe key={file.id} src={`/files/${file.id}`} title={`${label}: ${file.fileName}`} className="absolute inset-0 h-full w-full border-0 bg-deepest" />
              ) : (
                <p className="p-6 text-sm text-muted-foreground">Download this file to open it.</p>
              )}
            </div>

            {paper.files.length > 1 ? (
              <div className="flex gap-3 overflow-x-auto border-t bg-deepest px-3 py-3 md:px-4">
                {paper.files.map((f, i) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => choose(i)}
                    aria-label={`File ${i + 1}: ${f.fileName}`}
                    aria-current={i === index ? "true" : undefined}
                    className={`flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border-2 bg-card ${i === index ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"}`}
                  >
                    {!sample && isImage(f) ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a private file behind a signed redirect
                      <img src={`/files/${f.id}`} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <PaperArt kind={paper.kind} size="sm" />
                    )}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <aside className="flex shrink-0 flex-col gap-5 border-t bg-card px-5 py-5 md:overflow-y-auto md:w-[340px] md:border-t-0 md:border-l md:px-6 md:py-6">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[11px] tracking-[0.12em] text-label uppercase">
                {paper.name ? `${label} · ` : ""}
                {isCurrent ? "Current" : paper.kind === "other" ? "On file" : "Earlier"}
              </span>
              <Dialog.Title className="font-display text-2xl leading-tight font-semibold tracking-tight">{title}</Dialog.Title>
            </div>

            {days !== null && tone ? (
              <div className={`flex items-center gap-3.5 rounded-2xl border p-3.5 ${TONE_BOX[tone]}`}>
                <span className={`font-display text-[34px] leading-none font-semibold ${TONE_TEXT[tone]}`}>{Math.abs(days)}</span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{days < 0 ? (days === -1 ? "day late" : "days late") : days === 1 ? "day left" : "days left"}</span>
                  <span className="text-[13px] text-muted-foreground">
                    {days === 0 ? "Ends today" : days < 0 ? `Ended ${formatDate(paper.until!)}` : `Ends ${formatDate(paper.until!)}`}
                  </span>
                </span>
              </div>
            ) : null}

            <dl className="grid grid-cols-2 gap-x-3 gap-y-3.5">
              {paper.start ? <Fact term="From" value={formatDate(paper.start)} /> : null}
              {paper.until && days === null ? <Fact term="Until" value={formatDate(paper.until)} /> : null}
              {paper.dated ? <Fact term={paper.kind === "book" ? "Printed" : "Dated"} value={formatDate(paper.dated)} /> : null}
              {paper.amount !== null ? <Fact term="Paid" value={formatMoney(Number(paper.amount))} /> : null}
            </dl>

            <div className="flex flex-col gap-1 border-t pt-4">
              <span className="font-mono text-[11.5px] break-all text-muted-foreground">{file.fileName}</span>
              <span className="text-[12.5px] text-label">
                {formatBytes(file.sizeBytes)} · added {formatDate(file.createdAt)}
              </span>
            </div>

            <span className="flex-1" />

            <div className="flex flex-col gap-2.5">
              {renew ? (
                <div className="[&>button]:w-full">
                  <RenewSheet {...renew} variant="default" size="lg" onDone={goAway} />
                </div>
              ) : null}
              <div className="flex gap-2.5">
                {sample ? null : (
                  <a href={`/files/${file.id}?download=1`} className={`${buttonVariants({ variant: "outline" })} flex-1`}>
                    Download
                  </a>
                )}
                {canEdit && !sample ? <FileMenu file={file} label={label} onGone={goAway} /> : null}
              </div>
            </div>
          </aside>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[10.5px] tracking-[0.1em] text-label uppercase">{term}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

/** The rare file actions, tucked behind ⋯: replace the file, rename a Documents upload, delete. */
function FileMenu({ file, label, onGone }: { file: PaperFile; label: string; onGone: () => void }) {
  const owner = file.ownerType === "vehicle_renewal" ? ("vehicle_renewal" as const) : ("vehicle" as const);
  return (
    <PopoverButton icon="more" ariaLabel="More: replace, rename or delete" align="end">
      {(close) => (
        <div className="flex w-72 flex-col gap-3 p-1.5">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] tracking-[0.14em] text-label uppercase">Replace the file</span>
            <ReplaceFileForm
              id={file.id}
              owner={{ ownerType: owner, ownerId: file.ownerId }}
              onDone={() => {
                close();
                onGone();
              }}
            />
          </div>
          {owner === "vehicle" ? (
            <div className="flex flex-col gap-2 border-t pt-3">
              <span className="font-mono text-[10px] tracking-[0.14em] text-label uppercase">Title</span>
              <DocumentRenameForm id={file.id} title={file.title ?? ""} />
            </div>
          ) : null}
          <form
            action={async (fd) => {
              close();
              onGone();
              await deleteAttachment(fd);
            }}
            className="border-t pt-3"
          >
            <input type="hidden" name="id" value={file.id} />
            <SubmitButton variant="ghost" size="sm" className="w-full text-status-overdue" confirm={`Delete this ${label.toLowerCase()} file? This cannot be undone.`}>
              Delete this file…
            </SubmitButton>
          </form>
        </div>
      )}
    </PopoverButton>
  );
}

