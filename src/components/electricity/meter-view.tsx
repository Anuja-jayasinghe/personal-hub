import { Trash2 } from "lucide-react";
import Link from "next/link";
import { electricityBillHref } from "@/features/electricity/links";
import { BillChip } from "@/components/electricity/bill-chip";
import { LimitChips } from "@/components/electricity/limit-chips";
import { PaidStamp } from "@/components/electricity/mark-paid";
import { MeterBadge } from "@/components/electricity/meter-tone";
import { MonthlyChart } from "@/components/electricity/monthly-chart";
import { PopoverButton } from "@/components/electricity/popover-button";
import { ReadingForm } from "@/components/electricity/reading-form";
import { MeterInstrument } from "@/components/electricity/meter-instrument";
import { SubmitButton } from "@/components/shared/submit-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { ElectricityBill, ElectricityMeter, ElectricityReading } from "@/db/schema";
import { deleteReading, updateReading } from "@/features/electricity/actions";
import { billStatus } from "@/features/electricity/bill-logic";
import type { MeterData } from "@/features/electricity/meter-data";
import { kwhParts } from "@/features/electricity/overview";
import type { LastChecked } from "@/features/electricity/last-checked";
import type { MeterLimit } from "@/features/electricity/limits";
import { roomText, type LimitUnits } from "@/features/electricity/limits-text";
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

/** One bill, read-only (S.2a): opens it on the Bills page, where bills are paid and edited. */
function BillLine({ bill, today }: { bill: ElectricityBill; today: string }) {
  const status = billStatus(bill, today);
  return (
    <li className="border-t border-raised">
      <Link
        href={electricityBillHref(bill.id)}
        className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-40 flex-1 whitespace-nowrap">
          <span className="font-mono text-xs font-semibold uppercase">{formatMonth(monthOf(bill.readingDate))}</span>
          <span className="text-muted-foreground"> · {formatKwh(toCents(bill.units))}</span>
        </span>
        {bill.amount !== null ? <span className="font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums">{formatMoney(Number(bill.amount))}</span> : null}
        {status.state === "paid" ? <PaidStamp billId={bill.id} /> : <BillChip status={status} />}
        <span aria-hidden className="text-quiet">
          ›
        </span>
      </Link>
    </li>
  );
}

/**
 * One meter on its own (C78): the big number first, then the last bill and short lists of bills and
 * readings. Display only for the meter and its bills (S.2a, C106): readings come in through "Read the
 * meters", bills are paid and edited in Bills, and the meter itself is edited in Settings.
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
  live = null,
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
  /** True when this meter carries the house, false when idle, null when not set (#69). */
  live?: boolean | null;
}) {
  const { usage, last, lastStatus, bills, readingRows } = data;
  const readingById = new Map(readings.map((r) => [r.id, r]));
  const newest = readingRows[0];

  return (
    <div className="flex flex-col gap-3 md:gap-5">
      <header className="flex flex-wrap items-center gap-3">
        <MeterBadge name={meter.name} className="h-6 min-w-7 text-xs" />
        <h2 className="font-display text-2xl leading-none font-semibold tracking-tight">{meter.name}</h2>
        {meter.accountNumber ? <span className="font-mono text-[11px] text-label">ACCOUNT {meter.accountNumber}</span> : null}
        {meter.archivedAt ? <Badge variant="secondary">Archived</Badge> : null}
      </header>

      <div className="grid gap-3 md:gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <MeterInstrument
          size="lg"
          showName={false}
          low={units.low}
          high={units.high}
          meter={{
            id: meter.id,
            name: meter.name,
            used: limit.known ? limit.used : null,
            projected: usage.state === "ok" ? usage.projected : null,
            state: limit.state,
            live,
            reading: newest?.value ?? null,
            check,
            role: roomText(limit, units),
          }}
        />
        <div className="flex flex-col gap-3 md:gap-5">
          <section aria-label="This cycle" className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
            {usage.state === "ok" ? (
              <>
                <p className="flex items-baseline gap-2">
                  <span className="font-display text-4xl leading-none font-semibold tracking-tight">{Math.round(usage.units / 100)}</span>
                  <span className="text-sm text-muted-foreground">units used since the bill</span>
                </p>
                <CycleFacts days={usage.days} perDay={usage.dailyAverage} from={last ? toCents(last.currentReading) : null} />
                <span className="mt-1">
                  <LimitChips limit={limit} units={units} />
                </span>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {usage.state === "no-reading" ? `Read the meters to count from the ${formatDate(usage.sinceDate)} bill.` : "Add the last bill in Bills to start counting."}
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
          <Link href={electricityBillHref(last.id)} className={buttonVariants({ variant: lastStatus.state === "paid" ? "ghost" : "outline", size: "sm" })}>
            {lastStatus.state === "paid" ? "See in Bills" : "Pay in Bills"}
          </Link>
        </section>
      ) : null}
        </div>
      </div>


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
                  <BillLine key={b.id} bill={b} today={today} />
                ))}
              </ul>
              {bills.length > SHOWN ? (
                <details className="group">
                  <summary className="cursor-pointer border-t py-2.5 text-sm text-muted-foreground hover:text-foreground">
                    Show all {bills.length} bills
                  </summary>
                  <ul>
                    {bills.slice(SHOWN).map((b) => (
                      <BillLine key={b.id} bill={b} today={today} />
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
