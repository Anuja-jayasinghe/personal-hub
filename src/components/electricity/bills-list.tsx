import { Trash2 } from "lucide-react";
import { BillForm } from "@/components/electricity/bill-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { ElectricityBill } from "@/db/schema";
import { deleteBill, markBillPaid, markBillUnpaid, updateBill } from "@/features/electricity/actions";
import { billStatus } from "@/features/electricity/bill-logic";
import { formatKwh } from "@/features/electricity/usage";
import { toCents } from "@/lib/decimal";
import { formatDate, formatMoney } from "@/lib/format";

/** One meter's bills, newest first: status, mark paid / unpaid, edit, delete. */
export function BillsList({
  bills,
  today,
}: {
  bills: ElectricityBill[];
  today: string;
}) {
  if (bills.length === 0) return <p className="border-t p-3 text-sm text-muted-foreground">No bills yet.</p>;

  return (
    <ul className="flex flex-col divide-y border-t">
      {bills.map((b) => {
        const status = billStatus(b, today);
        return (
          <li key={b.id} className="p-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-medium">{formatDate(b.billDate)}</span>
              <span>{formatKwh(toCents(b.units))} used</span>
              {b.amount !== null ? <span>{formatMoney(Number(b.amount))}</span> : null}
              {status.state === "paid" ? <Badge variant="secondary">Paid {formatDate(status.paidDate)}</Badge> : null}
              {status.state === "overdue" ? (
                <Badge variant="destructive">
                  Overdue {status.days} day{status.days === 1 ? "" : "s"}
                </Badge>
              ) : null}
              {status.state === "due" ? (
                <Badge variant="outline">{status.days === 0 ? "Due today" : `Due in ${status.days} day${status.days === 1 ? "" : "s"}`}</Badge>
              ) : null}
              <form action={deleteBill} className="ml-auto">
                <input type="hidden" name="id" value={b.id} />
                <SubmitButton variant="ghost" size="icon-sm" aria-label={`Delete bill from ${formatDate(b.billDate)}`} confirm="Delete this bill? This cannot be undone.">
                  <Trash2 aria-hidden />
                </SubmitButton>
              </form>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Readings {formatKwh(toCents(b.previousReading))} to {formatKwh(toCents(b.currentReading))} on {formatDate(b.readingDate)}
              {b.dueDate ? ` · due ${formatDate(b.dueDate)}` : ""}
              {b.notes ? ` · ${b.notes}` : ""}
            </p>

            <div className="mt-2 flex flex-col gap-2">
              {status.state === "paid" ? (
                <form action={markBillUnpaid}>
                  <input type="hidden" name="id" value={b.id} />
                  <SubmitButton variant="outline" size="sm">
                    Mark unpaid
                  </SubmitButton>
                </form>
              ) : (
                <form action={markBillPaid} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={b.id} />
                  <Input type="date" name="paidDate" defaultValue={today} aria-label="Paid on" className="w-40" />
                  <SubmitButton size="sm">Mark paid</SubmitButton>
                </form>
              )}
              <details className="rounded-md border">
                <summary className="cursor-pointer px-3 py-1 text-xs text-muted-foreground">Edit</summary>
                <div className="border-t p-3">
                  <BillForm action={updateBill} bill={b} />
                </div>
              </details>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
