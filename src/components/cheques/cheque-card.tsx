import { Trash2 } from "lucide-react";
import { ChequeForm } from "@/components/cheques/cheque-form";
import { ChequePhotos, ChequeThumbs } from "@/components/cheques/cheque-photos";
import { DepositSheet } from "@/components/cheques/cheque-sheets";
import { StatusForm } from "@/components/cheques/status-form";
import { DaysRing } from "@/components/shared/days-ring";
import { SubmitButton } from "@/components/shared/submit-button";
import type { Attachment, Cheque } from "@/db/schema";
import { deleteCheque } from "@/features/cheques/actions";
import { staleLine, viewOf, type ChequeState } from "@/features/cheques/logic";
import { dayMonthIn } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

/** Chip colours by how a waiting cheque stands: calm until the day, amber on it, red once it is late or close to stale. */
const CHIP: Partial<Record<ChequeState, string>> = {
  today: "bg-status-soon-soft text-status-soon",
  late: "bg-status-overdue-soft text-status-overdue",
  "going-stale": "bg-status-overdue-soft text-status-overdue",
  stale: "bg-status-overdue-soft text-status-overdue",
};

/** The stub's lamp and word for a cheque that is no longer waiting. */
const STUB: Partial<Record<ChequeState, { lamp: string; word: string }>> = {
  deposited: { lamp: "bg-primary", word: "In the bank" },
  cleared: { lamp: "bg-status-ok", word: "Cleared" },
  bounced: { lamp: "bg-status-overdue", word: "Bounced" },
  cancelled: { lamp: "bg-quiet", word: "Cancelled" },
};

const row = "flex min-h-11 items-center justify-between gap-3 py-1 text-sm";

/**
 * A received cheque as a small ticket (issue #178): a stub on the left with the countdown ring (days until
 * it can be deposited, days late, or days until it goes stale) and a perforated edge, then who gave it, the
 * amount, the date and the one thing to do next. Everything else (edit, photos, the other outcomes,
 * delete) is tucked in "More", so each action has one home.
 */
export function ChequeCard({ cheque, photos, today }: { cheque: Cheque; photos: Pick<Attachment, "id" | "fileName" | "mimeType">[]; today: string }) {
  const view = viewOf(cheque, today);
  const waiting = cheque.status === "waiting";
  const stub = STUB[view.state];
  const meta = [cheque.bank, `dated ${dayMonthIn(cheque.chequeDate, today)}`].filter(Boolean).join(" · ");

  return (
    <li id={`cheque-${cheque.id}`} className="relative flex scroll-mt-20 overflow-hidden rounded-2xl border bg-card text-card-foreground">
      {/* The stub */}
      <div className="relative flex w-[88px] shrink-0 flex-col items-center justify-start gap-1 border-r border-dashed border-quiet bg-raised/40 px-2 py-3">
        {view.ring ? (
          <DaysRing days={view.ring.days} ofDays={view.ring.ofDays} size={64} label={view.spoken} />
        ) : stub ? (
          <>
            <span aria-hidden className={`size-3 rounded-full ${stub.lamp}`} />
            <span className="text-center font-mono text-[10.5px] leading-tight tracking-[0.12em] text-label uppercase">{stub.word}</span>
            {cheque.depositedOn ? <span className="text-center font-mono text-[10.5px] text-muted-foreground">{dayMonthIn(cheque.depositedOn, today)}</span> : null}
          </>
        ) : null}
        {/* The notches that make it a ticket */}
        <span aria-hidden className="absolute -top-2 -right-2 size-4 rounded-full border bg-background" />
        <span aria-hidden className="absolute -right-2 -bottom-2 size-4 rounded-full border bg-background" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3.5">
        <div>
          <h3 className="text-[15px] leading-snug font-semibold break-words">{cheque.fromParty}</h3>
          <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{formatMoney(Number(cheque.amount))}</p>
        </div>
        <p className="font-mono text-[10.5px] tracking-[0.12em] text-label uppercase">{meta}</p>

        {/* A chip only when there is something to act on: before the date the ring and the date above already say it all. */}
        {waiting && view.state !== "waiting" ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${CHIP[view.state] ?? ""}`}>{view.chip}</span>
            {/* The stale date is the chip itself once it is close or past; before that it is one small line. */}
            {view.state === "today" || view.state === "late" ? <span className="text-xs text-muted-foreground">{staleLine(view.staleOn, today)}</span> : null}
          </div>
        ) : waiting ? (
          <p className="text-xs text-muted-foreground">{staleLine(view.staleOn, today)}</p>
        ) : null}
        {cheque.note ? <p className="text-sm break-words whitespace-pre-wrap text-muted-foreground">{cheque.note}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          {waiting ? <DepositSheet id={cheque.id} today={today} /> : null}
          {cheque.status === "deposited" ? <StatusForm id={cheque.id} to="cleared" label="Mark cleared" variant="default" /> : null}
          <ChequeThumbs photos={photos} />
        </div>

        <details className="border-t border-raised">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm text-muted-foreground">More</summary>
          <div className="flex flex-col divide-y border-t">
            <details className="py-1">
              <summary className={`${row} cursor-pointer`}>Edit the details</summary>
              <div className="pb-3">
                <ChequeForm cheque={cheque} today={today} />
              </div>
            </details>
            <details className="py-1">
              <summary className={`${row} cursor-pointer`}>
                <span>Photos</span>
                <span className="font-mono text-xs text-muted-foreground">{photos.length} of 2</span>
              </summary>
              <div className="pb-3">
                <ChequePhotos chequeId={cheque.id} chequeDate={cheque.chequeDate} photos={photos} />
              </div>
            </details>
            {cheque.chequeNumber ? (
              <div className={row}>
                <span className="text-muted-foreground">Cheque number</span>
                <span className="font-mono">{cheque.chequeNumber}</span>
              </div>
            ) : null}
            {waiting || cheque.status === "deposited" ? (
              <div className="flex flex-col gap-2 py-2">
                <StatusForm id={cheque.id} to="bounced" label="It bounced" confirm="Mark this cheque as bounced?" />
                <StatusForm id={cheque.id} to="cancelled" label="Cancel this cheque" confirm="Cancel this cheque? It stops reminding. You can put it back to waiting later." />
              </div>
            ) : null}
            {cheque.status !== "waiting" ? (
              <div className="py-2">
                <StatusForm
                  id={cheque.id}
                  to="waiting"
                  label="Put it back to waiting"
                  variant="ghost"
                  confirm="Put this cheque back to waiting? Its deposit date is forgotten and it reminds again."
                />
              </div>
            ) : null}
            <form action={deleteCheque} className="py-2">
              <input type="hidden" name="id" value={cheque.id} />
              <SubmitButton variant="ghost" className="text-destructive" confirm="Permanently delete this cheque and its photos? This cannot be undone.">
                <Trash2 aria-hidden /> Delete
              </SubmitButton>
            </form>
          </div>
        </details>
      </div>
    </li>
  );
}
