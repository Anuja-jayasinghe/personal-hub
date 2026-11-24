import { Trash2 } from "lucide-react";
import { BillItemForm } from "@/components/bills/bill-item-form";
import { PaymentForm } from "@/components/bills/payment-form";
import { AttachmentsPanel } from "@/components/shared/attachments-panel";
import { SubmitButton } from "@/components/shared/submit-button";
import { Badge } from "@/components/ui/badge";
import type { Attachment, BillItem, BillPayment } from "@/db/schema";
import { archiveBillItem, deleteBillItem, deleteBillPayment, markBillItemPaid, unarchiveBillItem, updateBillItem, updateBillPayment } from "@/features/bills/actions";
import { sortPayments } from "@/features/bills/payments";
import { billDayWording, FREQUENCY_LABELS, markPaidHelp, paymentFor, rollForward } from "@/features/bills/schedule";
import { describeDays } from "@/features/reminders/engine";
import { dayMonthIn, daysBetween } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

/** One bill or subscription: what, how often, next due date, usual amount, edit, documents, archive, delete. */
export function BillItemCard({
  item,
  files,
  payments,
  receipts,
  today,
}: {
  item: BillItem;
  files: Attachment[];
  /** This item's payments, any order. */
  payments: BillPayment[];
  /** Receipts attached to payments, by payment id. */
  receipts: Map<string, Attachment[]>;
  today: string;
}) {
  const history = sortPayments(payments);
  const lastPaid = history[0];
  // An autopay item pays itself (C58): show its next charge, not a stale date it was "overdue" on.
  const shownDue = item.autopay ? rollForward(item, today) : item.nextDueDate;
  const days = shownDue ? daysBetween(today, shownDue) : null;
  // A monthly bill that is not on autopay is spoken of by its bill date (owner, 2026-11-24).
  const long = (ymd: string) => dayMonthIn(ymd, today);
  const billDay = item.nextDueDate ? billDayWording(item, item.nextDueDate, today) : null;
  const tone = days === null ? "" : days < 0 ? "font-medium text-status-overdue" : days <= 7 ? "text-status-soon" : "text-muted-foreground";

  return (
    <li id={`item-${item.id}`} className="scroll-mt-20 rounded-xl border bg-card p-4 text-card-foreground">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-medium">{item.name}</h2>
            <Badge variant="outline">{item.kind === "subscription" ? "Subscription" : "Bill"}</Badge>
            <Badge variant="secondary">{FREQUENCY_LABELS[item.frequency]}</Badge>
            {item.autopay ? <Badge variant="secondary">Autopay</Badge> : null}
            {item.archivedAt ? <Badge variant="secondary">Archived</Badge> : null}
          </div>
        </div>
        <form action={item.archivedAt ? unarchiveBillItem : archiveBillItem}>
          <input type="hidden" name="id" value={item.id} />
          <SubmitButton variant="outline" size="sm" confirm={item.archivedAt ? undefined : `Archive "${item.name}"? It stops reminding and is kept.`}>
            {item.archivedAt ? "Unarchive" : "Archive"}
          </SubmitButton>
        </form>
        <form action={deleteBillItem}>
          <input type="hidden" name="id" value={item.id} />
          <SubmitButton variant="ghost" size="icon" aria-label={`Delete ${item.name}`} confirm={`Permanently delete "${item.name}", its payment history and all its documents? This cannot be undone.`}>
            <Trash2 aria-hidden />
          </SubmitButton>
        </form>
      </div>
      {/* The facts get the whole card width: beside the Archive and Delete buttons they were squeezed into half of it (issue #42). */}
      <div className="mt-1">
        <p className="mt-1 text-sm">
          {shownDue && billDay && !billDay.payable ? (
            <>
              Next bill <span className="font-medium">{billDay.nextBill}</span>
              <span className="text-muted-foreground"> · payable from {billDay.payableFrom}</span>
            </>
          ) : shownDue && billDay?.payable ? (
            <>
              Bill of <span className="font-medium">{billDay.billOf}</span> · pay by <span className="font-medium">{billDay.payBy}</span>
              {days !== null ? <span className={tone}> · {describeDays(days)}</span> : null}
            </>
          ) : shownDue ? (
            <>
              {item.autopay ? "Next charge" : "Next due"} <span className="font-medium">{dayMonthIn(shownDue, today)}</span>
              {days !== null ? <span className={tone}> · {describeDays(days)}</span> : null}
            </>
          ) : (
            <span className="text-muted-foreground">Done (no next due date).</span>
          )}
          {item.amount !== null ? <span className="text-muted-foreground"> · usually {formatMoney(Number(item.amount))}</span> : null}
        </p>
        {lastPaid ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Last paid {dayMonthIn(lastPaid.paidDate, today)}
            {lastPaid.amount !== null ? ` · ${formatMoney(Number(lastPaid.amount))}` : ""}
          </p>
        ) : null}
        {item.paymentMethod ? <p className="mt-1 text-sm text-muted-foreground">Paid with {item.paymentMethod}</p> : null}
        {item.notes ? <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.notes}</p> : null}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {!item.archivedAt && item.nextDueDate && !(billDay && !billDay.payable) ? (
          <details className="rounded-md border border-primary/40">
            <summary className="cursor-pointer px-3 py-1.5 text-sm font-medium">Mark paid</summary>
            <div className="border-t p-3">
              <p className="mb-3 text-sm text-muted-foreground">{markPaidHelp({ ...item, nextDueDate: item.nextDueDate }, long, today)}</p>
              <PaymentForm action={markBillItemPaid} itemId={item.id} defaultDate={today} defaultAmount={item.amount} />
            </div>
          </details>
        ) : null}
        <details className="rounded-md border">
          <summary className="cursor-pointer px-3 py-1.5 text-sm text-muted-foreground">Payment history ({history.length})</summary>
          {history.length === 0 ? (
            <p className="border-t p-3 text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <ul className="flex flex-col divide-y border-t">
              {history.map((p) => (
                <li key={p.id} className="p-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-medium">{dayMonthIn(p.paidDate, today)}</span>
                    {p.amount !== null ? <span>{formatMoney(Number(p.amount))}</span> : null}
                    <span className="text-muted-foreground">for {paymentFor(item, p.dueDate, long, today)}</span>
                    {p.note ? <span className="text-muted-foreground">{p.note}</span> : null}
                    <form action={deleteBillPayment} className="ml-auto">
                      <input type="hidden" name="id" value={p.id} />
                      <SubmitButton
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete payment from ${dayMonthIn(p.paidDate, today)}`}
                        confirm="Delete this payment and its receipts? If it is the latest one, the item goes back to being due on the date it settled."
                      >
                        <Trash2 aria-hidden />
                      </SubmitButton>
                    </form>
                  </div>
                  <details className="mt-2 rounded-md border">
                    <summary className="cursor-pointer px-3 py-1 text-xs text-muted-foreground">Edit</summary>
                    <div className="border-t p-3">
                      <PaymentForm action={updateBillPayment} payment={p} />
                    </div>
                  </details>
                  <details className="mt-2 rounded-md border">
                    <summary className="cursor-pointer px-3 py-1 text-xs text-muted-foreground">Receipts ({(receipts.get(p.id) ?? []).length})</summary>
                    <div className="border-t p-3">
                      <AttachmentsPanel owner={{ ownerType: "bill_payment", ownerId: p.id }} items={receipts.get(p.id) ?? []} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </details>
        <details className="rounded-md border">
          <summary className="cursor-pointer px-3 py-1.5 text-sm text-muted-foreground">Edit</summary>
          <div className="border-t p-3">
            <BillItemForm action={updateBillItem} item={item} />
          </div>
        </details>
        <details className="rounded-md border">
          <summary className="cursor-pointer px-3 py-1.5 text-sm text-muted-foreground">Documents ({files.length})</summary>
          <div className="border-t p-3">
            <AttachmentsPanel owner={{ ownerType: "bill_item", ownerId: item.id }} items={files} />
          </div>
        </details>
      </div>
    </li>
  );
}
