import { Trash2 } from "lucide-react";
import { BillChip } from "@/components/electricity/bill-chip";
import { BillForm } from "@/components/electricity/bill-form";
import { MarkPaidButton, PaidStamp } from "@/components/electricity/mark-paid";
import { MeterBadge } from "@/components/electricity/meter-tone";
import { AddBillButton, PopoverButton } from "@/components/electricity/popover-button";
import { SubmitButton } from "@/components/shared/submit-button";
import type { ElectricityBill, ElectricityMeter } from "@/db/schema";
import { deleteBill, markBillUnpaid, updateBill } from "@/features/electricity/actions";
import { billStatus } from "@/features/electricity/bill-logic";
import { meterBillLabel } from "@/features/electricity/links";
import { formatKwh } from "@/features/electricity/usage";
import { toCents } from "@/lib/decimal";
import { dayMonthIn, monthOf } from "@/lib/dates";
import { formatMoney, formatMonth } from "@/lib/format";

const SHOWN = 6;

/** One electricity bill with everything you can do to it: mark paid or unpaid, edit, delete. */
function BillRow({ bill, today, meterName, canEdit }: { bill: ElectricityBill; today: string; meterName: string; canEdit: boolean }) {
  const status = billStatus(bill, today);
  const month = formatMonth(monthOf(bill.readingDate));
  const showDue = bill.dueDate !== null && status.state !== "paid";
  const amount = bill.amount !== null ? formatMoney(Number(bill.amount)) : null;
  return (
    <li id={`electricity-bill-${bill.id}`} className="flex scroll-mt-24 flex-wrap items-center gap-x-3 gap-y-1 border-t border-raised py-2.5 text-sm target:rounded-lg target:bg-accent target:px-2">
      {/* On a phone the amount sits under the month, and an unpaid bill's "More" button moves up beside the info with the
          status and Mark paid on the line below it (`max-sm:order-*`): squeezed into one row, "due 29 Nov" broke over
          three lines, the kWh ran into the amount and the "…" was left alone on a line of its own (issue #42). */}
      <span className="min-w-0 flex-1 max-sm:basis-44">
        <span className="block">
          <span className="font-mono text-xs font-semibold uppercase">{month}</span>
          <span className="text-muted-foreground"> · {formatKwh(toCents(bill.units))}</span>
        </span>
        {amount ? <span className="block font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums sm:hidden">{amount}</span> : null}
        {showDue ? <span className="block text-xs text-muted-foreground">due {dayMonthIn(bill.dueDate!, today)}</span> : null}
      </span>
      {amount ? <span className="hidden font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums sm:inline">{amount}</span> : null}
      {status.state === "paid" ? (
        <PaidStamp billId={bill.id} />
      ) : (
        <span className="max-sm:order-2">
          <BillChip status={status} />
        </span>
      )}
      {canEdit && status.state !== "paid" ? (
        <span className="max-sm:order-2">
          <MarkPaidButton billId={bill.id} what={`${meterName}'s ${month} bill`} amount={amount} today={today} size="sm" />
        </span>
      ) : null}
      {canEdit ? (
      <span className={`ml-auto ${status.state === "paid" ? "" : "max-sm:order-1"}`}>
        <PopoverButton variant="ghost" icon="more" ariaLabel={`More for the ${month} bill`} align="end">
          <div className="flex flex-col gap-2 p-1">
            {status.state === "paid" ? (
              <form action={markBillUnpaid}>
                <input type="hidden" name="id" value={bill.id} />
                <SubmitButton variant="outline" size="sm">
                  Mark unpaid
                </SubmitButton>
              </form>
            ) : null}
            <details className="rounded-md border">
              <summary className="cursor-pointer px-3 py-1.5 text-sm">Edit this bill</summary>
              <div className="border-t p-3">
                <BillForm action={updateBill} bill={bill} />
              </div>
            </details>
            <form action={deleteBill}>
              <input type="hidden" name="id" value={bill.id} />
              <SubmitButton variant="ghost" size="sm" confirm="Delete this bill? This cannot be undone.">
                <Trash2 aria-hidden /> Delete bill
              </SubmitButton>
            </form>
          </div>
        </PopoverButton>
      </span>
      ) : null}
    </li>
  );
}

/**
 * Electricity bills on the Bills page (S.2a; DECISIONS C106, reversing C57): all bill handling lives in
 * Bills. One group per active meter, labelled by the account number so it matches the paper bill, with
 * "Add bill" and each bill's actions. Electricity shows the same bills read-only and links here.
 */
export function ElectricityBills({
  meters,
  bills,
  today,
  can = { add: true, edit: true },
}: {
  meters: ElectricityMeter[];
  bills: ElectricityBill[];
  today: string;
  /** What this person may do (S.8, C114): add bills, and pay, change or delete them. */
  can?: { add: boolean; edit: boolean };
}) {
  if (meters.length === 0) return null;
  return (
    <section id="electricity" aria-labelledby="electricity-bills-title" className="flex scroll-mt-24 flex-col gap-3">
      <h2 id="electricity-bills-title" className="font-mono text-[10.5px] font-normal tracking-[0.14em] text-label uppercase">
        Electricity bills
      </h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {meters.map((m) => {
          const own = bills.filter((b) => b.meterId === m.id).sort((a, b) => (a.readingDate < b.readingDate ? 1 : -1));
          const last = own[0];
          return (
            <div key={m.id} className="flex flex-col rounded-2xl border bg-card px-4 pb-1">
              <div className="flex flex-wrap items-center gap-2.5 py-3">
                <MeterBadge name={m.name} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] leading-snug font-semibold break-words">{meterBillLabel(m)}</span>
                  {m.accountNumber ? <span className="block text-xs text-muted-foreground">{m.name}</span> : null}
                </span>
                {can.add ? <AddBillButton meterId={m.id} meterName={m.name} defaultDate={today} defaultPrevious={last?.currentReading} previousDate={last?.readingDate} /> : null}
              </div>
              {own.length === 0 ? (
                <p className="border-t border-raised py-3 text-sm text-muted-foreground">No bills yet. Add the last one so the cycle has a start.</p>
              ) : (
                <>
                  <ul>
                    {own.slice(0, SHOWN).map((b) => (
                      <BillRow key={b.id} bill={b} today={today} meterName={m.name} canEdit={can.edit} />
                    ))}
                  </ul>
                  {own.length > SHOWN ? (
                    <details>
                      <summary className="cursor-pointer border-t border-raised py-2.5 text-sm text-muted-foreground hover:text-foreground">Show all {own.length} bills</summary>
                      <ul>
                        {own.slice(SHOWN).map((b) => (
                          <BillRow key={b.id} bill={b} today={today} meterName={m.name} canEdit={can.edit} />
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
