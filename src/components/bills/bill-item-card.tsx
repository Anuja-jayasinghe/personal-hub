import { Trash2 } from "lucide-react";
import { BillItemForm } from "@/components/bills/bill-item-form";
import { AttachmentsPanel } from "@/components/shared/attachments-panel";
import { SubmitButton } from "@/components/shared/submit-button";
import { Badge } from "@/components/ui/badge";
import type { Attachment, BillItem } from "@/db/schema";
import { archiveBillItem, deleteBillItem, unarchiveBillItem, updateBillItem } from "@/features/bills/actions";
import { FREQUENCY_LABELS } from "@/features/bills/schedule";
import { describeDays } from "@/features/reminders/engine";
import { daysBetween } from "@/lib/dates";
import { formatDate, formatMoney } from "@/lib/format";

/** One bill or subscription: what, how often, next due date, usual amount, edit, documents, archive, delete. */
export function BillItemCard({ item, files, today }: { item: BillItem; files: Attachment[]; today: string }) {
  const days = item.nextDueDate ? daysBetween(today, item.nextDueDate) : null;
  const tone = days === null ? "" : days < 0 ? "font-medium text-status-overdue" : days <= 7 ? "text-status-soon" : "text-muted-foreground";

  return (
    <li className="rounded-xl border bg-card p-4 text-card-foreground">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-medium">{item.name}</h2>
            <Badge variant="outline">{item.kind === "subscription" ? "Subscription" : "Bill"}</Badge>
            <Badge variant="secondary">{FREQUENCY_LABELS[item.frequency]}</Badge>
            {item.autopay ? <Badge variant="secondary">Autopay</Badge> : null}
            {item.archivedAt ? <Badge variant="secondary">Archived</Badge> : null}
          </div>
          <p className="mt-1 text-sm">
            {item.nextDueDate ? (
              <>
                Next due <span className="font-medium">{formatDate(item.nextDueDate)}</span>
                {days !== null ? <span className={tone}> · {describeDays(days)}</span> : null}
              </>
            ) : (
              <span className="text-muted-foreground">Done (no next due date).</span>
            )}
            {item.amount !== null ? <span className="text-muted-foreground"> · usually {formatMoney(Number(item.amount))}</span> : null}
          </p>
          {item.paymentMethod ? <p className="mt-1 text-sm text-muted-foreground">Paid with {item.paymentMethod}</p> : null}
          {item.notes ? <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.notes}</p> : null}
        </div>
        <form action={item.archivedAt ? unarchiveBillItem : archiveBillItem}>
          <input type="hidden" name="id" value={item.id} />
          <SubmitButton variant="outline" size="sm" confirm={item.archivedAt ? undefined : `Archive "${item.name}"? It stops reminding and is kept.`}>
            {item.archivedAt ? "Unarchive" : "Archive"}
          </SubmitButton>
        </form>
        <form action={deleteBillItem}>
          <input type="hidden" name="id" value={item.id} />
          <SubmitButton variant="ghost" size="icon" aria-label={`Delete ${item.name}`} confirm={`Permanently delete "${item.name}" and its documents? This cannot be undone.`}>
            <Trash2 aria-hidden />
          </SubmitButton>
        </form>
      </div>

      <div className="mt-3 flex flex-col gap-2">
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
