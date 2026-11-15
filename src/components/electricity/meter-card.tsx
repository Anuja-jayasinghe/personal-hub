import { Trash2 } from "lucide-react";
import { BillForm } from "@/components/electricity/bill-form";
import { BillsList } from "@/components/electricity/bills-list";
import { CardPanels } from "@/components/electricity/card-panels";
import { MeterForm } from "@/components/electricity/meter-form";
import { ReadingForm } from "@/components/electricity/reading-form";
import { UsageSummary } from "@/components/electricity/usage-summary";
import { SubmitButton } from "@/components/shared/submit-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { appConfig } from "@/config/app.config";
import type { ElectricityBill, ElectricityMeter, ElectricityReading } from "@/db/schema";
import {
  addReading,
  archiveMeter,
  createBill,
  deleteMeter,
  deleteReading,
  markBillPaid,
  unarchiveMeter,
  updateMeter,
  updateReading,
} from "@/features/electricity/actions";
import { billStatus } from "@/features/electricity/bill-logic";
import { latestBill, sinceLastBill } from "@/features/electricity/since-bill";
import { formatKwh, sortReadings, toReading } from "@/features/electricity/usage";
import { toCents } from "@/lib/decimal";
import { formatDate, formatMoney } from "@/lib/format";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

const sectionSummary = "cursor-pointer px-3 py-1.5 text-sm";

/**
 * One meter as a card (C75): the last bill, the newest reading and what has been used since the bill
 * on the face; adding a reading is one small button, and everything else (add a bill, mark paid,
 * bills, reading history, edit, archive, delete) sits behind the Actions button.
 */
export function MeterCard({
  meter,
  readings,
  bills,
  today,
}: {
  meter: ElectricityMeter;
  /** This meter's readings. */
  readings: ElectricityReading[];
  /** This meter's bills. */
  bills: ElectricityBill[];
  today: string;
}) {
  const sorted = sortReadings(readings.map((r) => ({ ...toReading(r), row: r })));
  const marks = bills.map((b) => ({
    billDate: b.billDate,
    readingDate: b.readingDate,
    currentReading: toCents(b.currentReading),
    createdAt: b.createdAt,
    row: b,
  }));
  const last = latestBill(marks)?.row;
  const usage = sinceLastBill(marks, sorted, appConfig.electricity.billingCycleDays);
  // Only a reading taken after the last bill is "the latest reading" worth showing next to it.
  const newest = sorted.at(-1);
  const latest = newest && (!last || newest.date > last.readingDate) ? newest : undefined;
  const lastStatus = last ? billStatus(last, today) : null;
  const active = !meter.archivedAt;

  const actions = (
    <>
      {active ? (
        <details className="rounded-md border">
          <summary className={sectionSummary}>Add a bill</summary>
          <div className="border-t p-3">
            <BillForm action={createBill} meterId={meter.id} defaultDate={today} defaultPrevious={last?.currentReading} previousDate={last?.readingDate} />
          </div>
        </details>
      ) : null}

      {active && last && lastStatus && lastStatus.state !== "paid" ? (
        <details className="rounded-md border">
          <summary className={sectionSummary}>Mark the last bill paid</summary>
          <form action={markBillPaid} className="flex flex-wrap items-center gap-2 border-t p-3">
            <input type="hidden" name="id" value={last.id} />
            <Input type="date" name="paidDate" defaultValue={today} aria-label="Paid on" className="w-40" />
            <SubmitButton size="sm">Mark paid</SubmitButton>
          </form>
        </details>
      ) : null}

      <details className="rounded-md border">
        <summary className={sectionSummary}>Bills ({bills.length})</summary>
        <BillsList bills={[...bills].sort((a, b) => b.readingDate.localeCompare(a.readingDate) || b.createdAt.getTime() - a.createdAt.getTime())} today={today} />
      </details>

      <details className="rounded-md border">
        <summary className={sectionSummary}>Reading history ({readings.length})</summary>
        {readings.length === 0 ? (
          <p className="border-t p-3 text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ul className="flex flex-col divide-y border-t">
            {[...readings].sort((a, b) => b.readingDate.localeCompare(a.readingDate) || b.createdAt.getTime() - a.createdAt.getTime()).map((r) => (
              <li key={r.id} className="p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium">{formatDate(r.readingDate)}</span>
                  <span>{formatKwh(toCents(r.value))}</span>
                  {r.replacedFinalValue !== null ? (
                    <Badge variant="secondary">Meter replaced · old meter ended at {formatKwh(toCents(r.replacedFinalValue))}</Badge>
                  ) : null}
                  {r.source === "auto" ? <Badge variant="outline">auto</Badge> : null}
                  {r.note ? <span className="text-muted-foreground">{r.note}</span> : null}
                  <form action={deleteReading} className="ml-auto">
                    <input type="hidden" name="id" value={r.id} />
                    <SubmitButton variant="ghost" size="icon-sm" aria-label={`Delete reading from ${formatDate(r.readingDate)}`} confirm="Delete this reading?">
                      <Trash2 aria-hidden />
                    </SubmitButton>
                  </form>
                </div>
                <details className="mt-2 rounded-md border">
                  <summary className="cursor-pointer px-3 py-1 text-xs text-muted-foreground">Edit</summary>
                  <div className="border-t p-3">
                    <ReadingForm action={updateReading} reading={r} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className="rounded-md border">
        <summary className={sectionSummary}>Edit meter</summary>
        <div className="border-t p-3">
          <MeterForm action={updateMeter} meter={meter} />
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-2 pt-1">
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
    </>
  );

  return (
    <li className="@container flex flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-medium">{meter.name}</h2>
        {meter.accountNumber ? <Badge variant="outline">{meter.accountNumber}</Badge> : null}
        {meter.archivedAt ? <Badge variant="secondary">Archived</Badge> : null}
      </div>

      <dl className="grid gap-3">
        <Row label="Last bill">
          {last ? (
            <>
              <span className="font-medium">{formatDate(last.billDate)}</span> · reading {formatKwh(toCents(last.currentReading))}
              {last.amount !== null ? ` · ${formatMoney(Number(last.amount))}` : ""}
              <span className="mt-1 block">
                {lastStatus?.state === "paid" ? <Badge variant="secondary">Paid {formatDate(lastStatus.paidDate)}</Badge> : null}
                {lastStatus?.state === "overdue" ? (
                  <Badge variant="destructive">Overdue {lastStatus.days} day{lastStatus.days === 1 ? "" : "s"}</Badge>
                ) : null}
                {lastStatus?.state === "due" ? (
                  <Badge variant="outline">{lastStatus.days === 0 ? "Due today" : `Unpaid, due in ${lastStatus.days} day${lastStatus.days === 1 ? "" : "s"}`}</Badge>
                ) : null}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">No bill yet</span>
          )}
        </Row>

        <Row label="Latest reading">
          {latest ? (
            <>
              <span className="font-medium">{formatKwh(latest.value)}</span>
              <span className="text-muted-foreground"> on {formatDate(latest.date)}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{last ? "None since the last bill" : "None yet"}</span>
          )}
        </Row>

        <Row label="Used since the last bill">
          <UsageSummary usage={usage} />
        </Row>
      </dl>

      {meter.notes ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{meter.notes}</p> : null}

      <CardPanels
        reading={active ? <ReadingForm action={addReading} meterId={meter.id} defaultDate={today} /> : undefined}
        actions={actions}
      />
    </li>
  );
}
