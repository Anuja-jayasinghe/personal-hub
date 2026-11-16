import { Trash2 } from "lucide-react";
import { BillChip } from "@/components/electricity/bill-chip";
import { BillForm } from "@/components/electricity/bill-form";
import { MeterForm } from "@/components/electricity/meter-form";
import { MeterBadge } from "@/components/electricity/meter-tone";
import { AddBillButton, AddReadingButton, PopoverButton } from "@/components/electricity/popover-button";
import { ReadingForm } from "@/components/electricity/reading-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { ElectricityBill, ElectricityMeter, ElectricityReading } from "@/db/schema";
import {
  archiveMeter,
  deleteBill,
  deleteMeter,
  deleteReading,
  markBillPaid,
  markBillUnpaid,
  unarchiveMeter,
  updateBill,
  updateMeter,
  updateReading,
} from "@/features/electricity/actions";
import { billStatus } from "@/features/electricity/bill-logic";
import type { MeterData } from "@/features/electricity/meter-data";
import { kwhParts } from "@/features/electricity/overview";
import { formatKwh } from "@/features/electricity/usage";
import { toCents } from "@/lib/decimal";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import { monthOf } from "@/lib/dates";

const SHOWN = 4; // rows shown before "Show all"

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-1 text-sm font-medium text-muted-foreground">{children}</h3>;
}

function BillRow({ bill, today }: { bill: ElectricityBill; today: string }) {
  const status = billStatus(bill, today);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t py-2.5 text-sm">
      <span className="min-w-40 flex-1 whitespace-nowrap">
        <span className="font-medium">{formatMonth(monthOf(bill.readingDate))}</span>
        <span className="text-muted-foreground"> · {formatKwh(toCents(bill.units))}</span>
      </span>
      {bill.amount !== null ? <span className="whitespace-nowrap text-muted-foreground tabular-nums">{formatMoney(Number(bill.amount))}</span> : null}
      <BillChip status={status} />
      <span className="ml-auto">
      <PopoverButton variant="ghost" icon="more" ariaLabel={`Actions for the ${formatDate(bill.billDate)} bill`} align="end">
        <div className="flex flex-col gap-2 p-1">
          {status.state === "paid" ? (
            <form action={markBillUnpaid}>
              <input type="hidden" name="id" value={bill.id} />
              <SubmitButton variant="outline" size="sm">Mark unpaid</SubmitButton>
            </form>
          ) : (
            <form action={markBillPaid} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={bill.id} />
              <Input type="date" name="paidDate" defaultValue={today} aria-label="Paid on" className="w-40" />
              <SubmitButton size="sm" confirm={`Mark the ${formatMonth(monthOf(bill.readingDate))} bill${bill.amount !== null ? ` (${formatMoney(Number(bill.amount))})` : ""} as paid? You can undo it.`}>
                Mark paid
              </SubmitButton>
            </form>
          )}
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
    </li>
  );
}

/**
 * One meter on its own (C78): the big number first, then the last bill, two clear buttons, and
 * short lists of bills and readings. Editing, archiving and deleting sit behind "More".
 */
export function MeterView({
  meter,
  toneIndex,
  data,
  readings,
  today,
}: {
  meter: ElectricityMeter;
  toneIndex: number;
  data: MeterData;
  readings: ElectricityReading[];
  today: string;
}) {
  const { usage, last, lastStatus, bills, readingRows } = data;
  const active = !meter.archivedAt;
  const used = usage.state === "ok" ? kwhParts(usage.units) : null;
  const readingById = new Map(readings.map((r) => [r.id, r]));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-3">
        <MeterBadge name={meter.name} index={toneIndex} className="size-7 text-sm" />
        <h2 className="text-xl font-medium">{meter.name}</h2>
        {meter.accountNumber ? <span className="text-sm text-muted-foreground">account {meter.accountNumber}</span> : null}
        {meter.archivedAt ? <Badge variant="secondary">Archived</Badge> : null}
        <span className="ml-auto">
          <PopoverButton variant="ghost" label="More" icon="chevron" align="end">
            <div className="flex flex-col gap-2 p-1">
              <details className="rounded-md border">
                <summary className="cursor-pointer px-3 py-1.5 text-sm">Edit meter</summary>
                <div className="border-t p-3">
                  <MeterForm action={updateMeter} meter={meter} />
                </div>
              </details>
              <form action={active ? archiveMeter : unarchiveMeter}>
                <input type="hidden" name="id" value={meter.id} />
                <SubmitButton variant="outline" size="sm" confirm={active ? `Archive "${meter.name}"? Its readings and bills are kept.` : undefined}>
                  {active ? "Archive meter" : "Unarchive meter"}
                </SubmitButton>
              </form>
              <form action={deleteMeter}>
                <input type="hidden" name="id" value={meter.id} />
                <SubmitButton variant="ghost" size="sm" confirm={`Permanently delete "${meter.name}" and all its readings and bills? This cannot be undone.`}>
                  <Trash2 aria-hidden /> Delete meter
                </SubmitButton>
              </form>
            </div>
          </PopoverButton>
        </span>
      </header>

      <section aria-label="Usage since the last bill">
        <p className="text-5xl leading-none font-medium tabular-nums">
          {used ? (
            <>
              {used.value} <span className="text-xl font-normal text-muted-foreground">{used.unit}</span>
            </>
          ) : (
            <span className="text-muted-foreground">–</span>
          )}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {usage.state === "ok"
            ? `used since your last bill on ${formatDate(usage.sinceDate)}, from a reading of ${last ? formatKwh(toCents(last.currentReading)) : ""}: ${usage.days} day${usage.days === 1 ? "" : "s"}${
                usage.dailyAverage !== null ? `, about ${formatKwh(usage.dailyAverage)} a day` : ""
              }`
            : usage.state === "no-reading"
              ? `No reading since your last bill on ${formatDate(usage.sinceDate)}${last ? ` (reading ${formatKwh(toCents(last.currentReading))})` : ""}. Add a reading to see your usage.`
              : "No bill yet. Add a bill to see your usage since it."}
        </p>
      </section>

      {last && lastStatus ? (
        <section aria-label="Last bill" className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/60 px-4 py-3">
          <div className="min-w-48 flex-1 text-sm">
            <p>
              <span className="font-medium">Last bill, {formatMonth(monthOf(last.readingDate))}</span>
              <span className="text-muted-foreground">
                {" "}
                · {formatKwh(toCents(last.units))}
                {last.amount !== null ? ` · ${formatMoney(Number(last.amount))}` : ""}
              </span>
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-2">
              <BillChip status={lastStatus} />
              {lastStatus.state === "paid" ? (
                <span className="text-xs text-muted-foreground">paid on {formatDate(lastStatus.paidDate)}</span>
              ) : last.dueDate ? (
                <span className="text-xs text-muted-foreground">due {formatDate(last.dueDate)}</span>
              ) : null}
            </p>
          </div>
          {active ? (
            lastStatus.state === "paid" ? (
              <form action={markBillUnpaid}>
                <input type="hidden" name="id" value={last.id} />
                <SubmitButton variant="ghost" size="sm" aria-label={`Undo: mark the ${formatMonth(monthOf(last.readingDate))} bill unpaid again`}>
                  Undo
                </SubmitButton>
              </form>
            ) : (
              <form action={markBillPaid}>
                <input type="hidden" name="id" value={last.id} />
                <SubmitButton
                  variant="outline"
                  size="sm"
                  confirm={`Mark the ${formatMonth(monthOf(last.readingDate))} bill${last.amount !== null ? ` (${formatMoney(Number(last.amount))})` : ""} as paid today? You can undo it.`}
                >
                  Mark paid
                </SubmitButton>
              </form>
            )
          ) : null}
        </section>
      ) : null}

      {active ? (
        <div className="flex flex-wrap gap-2">
          <AddReadingButton meterId={meter.id} defaultDate={today} />
          <AddBillButton meterId={meter.id} defaultDate={today} defaultPrevious={last?.currentReading} previousDate={last?.readingDate} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-label="Bills">
          <SectionTitle>Bills</SectionTitle>
          {bills.length === 0 ? (
            <p className="border-t py-3 text-sm text-muted-foreground">No bills yet.</p>
          ) : (
            <>
              <ul>
                {bills.slice(0, SHOWN).map((b) => (
                  <BillRow key={b.id} bill={b} today={today} />
                ))}
              </ul>
              {bills.length > SHOWN ? (
                <details className="group">
                  <summary className="cursor-pointer border-t py-2.5 text-sm text-muted-foreground hover:text-foreground">
                    Show all {bills.length} bills
                  </summary>
                  <ul>
                    {bills.slice(SHOWN).map((b) => (
                      <BillRow key={b.id} bill={b} today={today} />
                    ))}
                  </ul>
                </details>
              ) : null}
            </>
          )}
        </section>

        <section aria-label="Readings">
          <SectionTitle>Readings</SectionTitle>
          {readingRows.length === 0 ? (
            <p className="border-t py-3 text-sm text-muted-foreground">No readings yet.</p>
          ) : (
            <>
              <ul>
                {readingRows.slice(0, SHOWN).map((r) => (
                  <ReadingRowItem key={r.id} row={r} reading={readingById.get(r.id)} />
                ))}
              </ul>
              {readingRows.length > SHOWN ? (
                <details>
                  <summary className="cursor-pointer border-t py-2.5 text-sm text-muted-foreground hover:text-foreground">
                    Show all {readingRows.length} readings
                  </summary>
                  <ul>
                    {readingRows.slice(SHOWN).map((r) => (
                      <ReadingRowItem key={r.id} row={r} reading={readingById.get(r.id)} />
                    ))}
                  </ul>
                </details>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ReadingRowItem({ row, reading }: { row: MeterData["readingRows"][number]; reading: ElectricityReading | undefined }) {
  const kwh = kwhParts(row.value);
  return (
    <li className="flex items-center gap-3 border-t py-2.5 text-sm">
      <span className="min-w-0 flex-1">
        {formatDate(row.date)}
        {row.replaced ? <span className="ml-2 text-xs text-muted-foreground">meter replaced</span> : null}
      </span>
      <span className="tabular-nums">{kwh.value}</span>
      <span className="w-16 text-right text-muted-foreground tabular-nums">{row.delta === null ? "" : `+${kwhParts(row.delta).value}`}</span>
      {reading ? (
        <PopoverButton variant="ghost" icon="more" ariaLabel={`Actions for the reading on ${formatDate(row.date)}`} align="end">
          <div className="flex flex-col gap-2 p-1">
            <details className="rounded-md border" open>
              <summary className="cursor-pointer px-3 py-1.5 text-sm">Edit this reading</summary>
              <div className="border-t p-3">
                <ReadingForm action={updateReading} reading={reading} />
              </div>
            </details>
            <form action={deleteReading}>
              <input type="hidden" name="id" value={reading.id} />
              <SubmitButton variant="ghost" size="sm" confirm="Delete this reading?">
                <Trash2 aria-hidden /> Delete reading
              </SubmitButton>
            </form>
          </div>
        </PopoverButton>
      ) : null}
    </li>
  );
}
