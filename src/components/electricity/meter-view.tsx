import { Trash2 } from "lucide-react";
import { BillChip } from "@/components/electricity/bill-chip";
import { BillForm } from "@/components/electricity/bill-form";
import { MeterForm } from "@/components/electricity/meter-form";
import { LastCheckedLine } from "@/components/electricity/last-checked-line";
import { LimitChips } from "@/components/electricity/limit-chips";
import { MarkPaidButton, PaidStamp } from "@/components/electricity/mark-paid";
import { MeterBadge } from "@/components/electricity/meter-tone";
import { MonthlyChart } from "@/components/electricity/monthly-chart";
import { AddBillButton, AddReadingButton, PopoverButton } from "@/components/electricity/popover-button";
import { ReadingForm } from "@/components/electricity/reading-form";
import { SlabRule } from "@/components/electricity/slab-rule";
import { SubmitButton } from "@/components/shared/submit-button";
import { Badge } from "@/components/ui/badge";
import type { ElectricityBill, ElectricityMeter, ElectricityReading } from "@/db/schema";
import {
  archiveMeter,
  deleteBill,
  deleteMeter,
  deleteReading,
  markBillUnpaid,
  unarchiveMeter,
  updateBill,
  updateMeter,
  updateReading,
} from "@/features/electricity/actions";
import { billStatus } from "@/features/electricity/bill-logic";
import type { MeterData } from "@/features/electricity/meter-data";
import { readingDigits } from "@/features/electricity/cycle";
import { kwhParts } from "@/features/electricity/overview";
import type { LastChecked } from "@/features/electricity/last-checked";
import type { MeterLimit } from "@/features/electricity/limits";
import { leftHeadline, type LimitUnits } from "@/features/electricity/limits-text";
import { formatKwh } from "@/features/electricity/usage";
import { toCents } from "@/lib/decimal";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import { monthOf } from "@/lib/dates";

const SHOWN = 4; // rows shown before "Show all"

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="py-2.5 text-sm font-semibold">{children}</h3>;
}

/** Three short facts in the mono label style: days since the bill, kWh a day, the bill reading it started from. */
function CycleFacts({ days, perDay, from }: { days: number | null; perDay: number | null; from: number | null }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] tracking-wide text-label tabular-nums uppercase">
      {days !== null ? <li>Day {days}</li> : null}
      {perDay !== null ? <li>{kwhParts(perDay).value} a day</li> : null}
      {from !== null ? <li>From {kwhParts(from).value}</li> : null}
    </ul>
  );
}

function BillRow({ bill, today, meterName }: { bill: ElectricityBill; today: string; meterName: string }) {
  const status = billStatus(bill, today);
  const month = formatMonth(monthOf(bill.readingDate));
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-raised py-2.5 text-sm">
      <span className="min-w-40 flex-1 whitespace-nowrap">
        <span className="font-mono text-xs font-semibold uppercase">{formatMonth(monthOf(bill.readingDate))}</span>
        <span className="text-muted-foreground"> · {formatKwh(toCents(bill.units))}</span>
      </span>
      {bill.amount !== null ? <span className="font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums">{formatMoney(Number(bill.amount))}</span> : null}
      {status.state === "paid" ? <PaidStamp billId={bill.id} /> : <BillChip status={status} />}
      <span className="ml-auto">
      <PopoverButton variant="ghost" icon="more" ariaLabel={`Actions for the ${formatDate(bill.billDate)} bill`} align="end">
        <div className="flex flex-col gap-2 p-1">
          {status.state === "paid" ? (
            <form action={markBillUnpaid}>
              <input type="hidden" name="id" value={bill.id} />
              <SubmitButton variant="outline" size="sm">Mark unpaid</SubmitButton>
            </form>
          ) : (
            <MarkPaidButton
              billId={bill.id}
              what={`${meterName}'s ${month} bill`}
              amount={bill.amount !== null ? formatMoney(Number(bill.amount)) : null}
              today={today}
              size="sm"
            />
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
  allMeters,
  data,
  readings,
  today,
  limit,
  units,
  check,
}: {
  meter: ElectricityMeter;
  /** Every meter, active first: gives the chart each meter's colour. */
  allMeters: ElectricityMeter[];
  data: MeterData;
  readings: ElectricityReading[];
  today: string;
  /** This meter against its current limit (2b.3). */
  limit: MeterLimit;
  units: LimitUnits;
  check: LastChecked;
}) {
  const { usage, last, lastStatus, bills, readingRows } = data;
  const active = !meter.archivedAt;
  const headline = limit.known ? leftHeadline(limit) : null;
  const readingById = new Map(readings.map((r) => [r.id, r]));
  const newest = readingRows[0];
  const digits = newest ? readingDigits(newest.value) : null;

  return (
    <div className="flex flex-col gap-3 md:gap-5">
      <header className="flex flex-wrap items-center gap-3">
        <MeterBadge name={meter.name} className="h-6 min-w-7 text-xs" />
        <h2 className="font-display text-2xl leading-none font-semibold tracking-tight">{meter.name}</h2>
        {meter.accountNumber ? <span className="font-mono text-[11px] text-label">ACCOUNT {meter.accountNumber}</span> : null}
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

      <section
        aria-label="Units left to the limit"
        className="flex flex-col gap-4 rounded-3xl border border-raised bg-deepest bg-[radial-gradient(var(--card)_1px,transparent_1px)] bg-size-[14px_14px] p-5"
      >
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          {headline ? (
            <>
              <span className="font-display text-7xl leading-[0.82] font-semibold tracking-tight md:text-8xl">{headline.value}</span>
              <span className="pb-1">
                <span className="block text-[15px] font-semibold">{headline.label === "left" ? `units to ${Math.round(limit.limit / 100)}` : `units over ${Math.round(limit.limit / 100)}`}</span>
                <span className="mt-1 block">
                  <LimitChips limit={limit} units={units} />
                </span>
              </span>
            </>
          ) : (
            <span className="font-display text-7xl leading-[0.82] font-semibold text-quiet">–</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {digits ? (
            <span role="img" aria-label={`Last reading ${digits.join("")}`} className="flex gap-0.5">
              {digits.map((d, i) => (
                <span
                  key={i}
                  className={`flex h-8 w-6 items-center justify-center rounded-[5px] font-mono text-base font-semibold ${
                    i === digits.length - 1 ? "bg-primary text-primary-foreground" : "bg-raised text-foreground"
                  }`}
                >
                  {d}
                </span>
              ))}
            </span>
          ) : null}
          <span className="ml-auto">
            <LastCheckedLine check={check} />
          </span>
        </div>
      </section>

      <section aria-label="Against the slabs" className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
        {usage.state === "ok" ? (
          <>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-[15px] font-semibold">{Math.round(usage.units / 100)} used since the bill</span>
              <span className="ml-auto">
                <CycleFacts days={usage.days} perDay={usage.dailyAverage} from={last ? toCents(last.currentReading) : null} />
              </span>
            </div>
            <SlabRule used={limit.used} projected={usage.projected} low={units.low * 100} high={units.high * 100} state={limit.state} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {usage.state === "no-reading"
              ? `Add a reading to count from the ${formatDate(usage.sinceDate)} bill.`
              : "Add a bill to start counting."}
          </p>
        )}
      </section>

      {last && lastStatus ? (
        <section aria-label="Last bill" className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
          <div className="min-w-48 flex-1 text-sm">
            <p>
              <span className="text-[15px] font-semibold">Last bill</span>
              <span className="ml-2 font-mono text-[11px] text-label uppercase">{formatMonth(monthOf(last.readingDate))}</span>
            </p>
            <p className="mt-1.5">
              {last.amount !== null ? <span className="font-display text-2xl font-semibold tracking-tight">{formatMoney(Number(last.amount))}</span> : null}
              <span className="block text-xs text-muted-foreground">
                {formatKwh(toCents(last.units))} · the cycle started at {kwhParts(toCents(last.currentReading)).value} on {formatDate(last.readingDate)}
              </span>
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-2">
              {lastStatus.state === "paid" ? <PaidStamp billId={last.id} /> : <BillChip status={lastStatus} />}
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
              <MarkPaidButton
                billId={last.id}
                what={`${meter.name}'s ${formatMonth(monthOf(last.readingDate))} bill`}
                amount={last.amount !== null ? formatMoney(Number(last.amount)) : null}
                today={today}
                size="lg"
              />
            )
          ) : null}
        </section>
      ) : null}

      {active ? (
        <div className="flex flex-wrap gap-2">
          <AddReadingButton meterId={meter.id} meterName={meter.name} defaultDate={today} />
          <AddBillButton meterId={meter.id} meterName={meter.name} defaultDate={today} defaultPrevious={last?.currentReading} previousDate={last?.readingDate} />
        </div>
      ) : null}

      {bills.length > 0 ? <MonthlyChart meters={allMeters} bills={bills} /> : null}

      <div className="grid grid-cols-1 gap-3 md:gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-label="Bills" className="rounded-2xl border bg-card px-4 pb-1">
          <SectionTitle>Bills</SectionTitle>
          {bills.length === 0 ? (
            <p className="border-t py-3 text-sm text-muted-foreground">No bills yet.</p>
          ) : (
            <>
              <ul>
                {bills.slice(0, SHOWN).map((b) => (
                  <BillRow key={b.id} bill={b} today={today} meterName={meter.name} />
                ))}
              </ul>
              {bills.length > SHOWN ? (
                <details className="group">
                  <summary className="cursor-pointer border-t py-2.5 text-sm text-muted-foreground hover:text-foreground">
                    Show all {bills.length} bills
                  </summary>
                  <ul>
                    {bills.slice(SHOWN).map((b) => (
                      <BillRow key={b.id} bill={b} today={today} meterName={meter.name} />
                    ))}
                  </ul>
                </details>
              ) : null}
            </>
          )}
        </section>

        <section aria-label="Readings" className="rounded-2xl border bg-card px-4 pb-1">
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
    <li className="flex items-center gap-3 border-t border-raised py-2.5 text-sm">
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-label" />
      <span className="min-w-0 flex-1 font-mono text-[11px] text-label uppercase">
        {formatDate(row.date)}
        {row.replaced ? <span className="ml-2 normal-case">meter replaced</span> : null}
      </span>
      <span className="font-mono text-sm font-semibold tabular-nums">{kwh.value}</span>
      <span className="w-16 text-right font-mono text-xs text-muted-foreground tabular-nums">{row.delta === null ? "" : `+${kwhParts(row.delta).value}`}</span>
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
