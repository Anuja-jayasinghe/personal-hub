"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { SheetPanel } from "@/components/shared/sheet-button";
import { PaperArt } from "@/components/vehicles/paper-art";
import { PaperForm } from "@/components/vehicles/paper-form";
import type { Checklist, ChecklistKind } from "@/features/vehicles/checklist";
import type { PaperContext } from "@/features/vehicles/paper-flow";

/**
 * "Let's set up the <nickname>" (V.4, C151; the owner-approved design "A brand-new vehicle"): a progress bar and one
 * row per paper the person may add, each opening the one flow for papers with that kind chosen. A row that is done
 * is ticked and no longer a button. The card is not a reminder and says nothing to the notification system; the
 * page decides whether to draw it at all (`newVehicleChecklist`), and it is gone once every row is done. In the demo
 * (`readOnly`) it is drawn as a sample: the rows open nothing, because the demo adds and saves nothing.
 */

const mono = "font-mono text-[11px] tracking-[0.08em] text-label";

export function NewVehicleChecklist({ checklist, ctx, note, readOnly = false }: { checklist: Checklist; ctx: PaperContext; note: string | null; readOnly?: boolean }) {
  const [kind, setKind] = useState<ChecklistKind | null>(null);
  const { rows, done, total } = checklist;
  const records = ctx.can.records || readOnly;

  return (
    <>
      <section aria-labelledby="checklist-title" className="flex flex-col gap-3 rounded-[20px] border bg-card p-4 pt-[18px] md:p-5">
        <div className="flex flex-col gap-1">
          <h2 id="checklist-title" className="font-display text-[22px] leading-tight font-bold tracking-tight">
            Let&rsquo;s set up the {ctx.vehicleName}
          </h2>
          <p className="text-[13px] leading-normal text-muted-foreground">
            {records ? "Add what you have. Each paper makes its record, and the hub reminds you before it runs out." : "Add what you have. The hub keeps each paper safe with the vehicle."}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <span
            role="progressbar"
            aria-label={`${done} of ${total} set up`}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised"
          >
            <span className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.round((done / total) * 100)}%` }} />
          </span>
          <span className={mono} aria-hidden>
            {done} OF {total}
          </span>
        </div>

        <ul className="flex flex-col">
          {rows.map((r) => (
            <li key={r.kind} className="border-b border-border/70 last:border-b-0">
              {r.done ? (
                <div className="flex min-h-14 items-center gap-3 px-0.5 py-1.5">
                  <Swatch kind={r.kind} faded />
                  <span className="flex-1 text-[14.5px] font-semibold text-muted-foreground">{r.label}</span>
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-status-ok">
                    <Check aria-hidden className="size-4" />
                    Added
                  </span>
                </div>
              ) : readOnly ? (
                <div className="flex min-h-14 items-center gap-3 px-0.5 py-1.5">
                  <Swatch kind={r.kind} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[14.5px] font-semibold">{r.label}</span>
                    <span className="text-xs text-label">{r.hint}</span>
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setKind(r.kind)}
                  aria-label={`Add the ${r.label.toLowerCase()}`}
                  className="flex min-h-14 w-full items-center gap-3 rounded-lg px-0.5 py-1.5 text-left outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Swatch kind={r.kind} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[14.5px] font-semibold">{r.label}</span>
                    <span className="text-xs text-label">{r.hint}</span>
                  </span>
                  <span aria-hidden className="text-[13px] font-semibold text-primary">
                    Add
                  </span>
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {readOnly ? (
        <p className="px-1 font-mono text-[11px] tracking-[0.08em] text-label uppercase">Sample · adding is turned off in the demo</p>
      ) : note ? (
        <p className="px-1 text-[12.5px] leading-normal text-label">{note}</p>
      ) : null}

      <SheetPanel
        open={kind !== null}
        onOpenChange={(o) => {
          if (!o) setKind(null);
        }}
        title="Add a paper"
        crumb={`/ ${ctx.vehicleName} / New paper`}
        description="The file, what it is and its dates. The hub makes the record and names the file."
      >
        {(close) => (kind ? <PaperForm key={kind} ctx={ctx} kind={kind} onDone={close} /> : null)}
      </SheetPanel>
    </>
  );
}

/** The paper's small drawing in a fixed box, so every row lines up whatever the paper's shape. */
function Swatch({ kind, faded = false }: { kind: ChecklistKind; faded?: boolean }) {
  return (
    <span aria-hidden className="flex h-11 w-[42px] shrink-0 items-center justify-center">
      <PaperArt kind={kind} size="xs" faded={faded} />
    </span>
  );
}
