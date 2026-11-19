import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BillItemCard } from "@/components/bills/bill-item-card";
import { BillsCalendar } from "@/components/bills/bills-calendar";
import { CommitmentsCard } from "@/components/bills/commitments-card";
import { ElectricityBills } from "@/components/bills/electricity-bills";
import { UpcomingList } from "@/components/bills/upcoming-list";
import { NextDaysLine } from "@/components/home/next-days-line";
import { AddBillItemSheet } from "@/components/shared/add-sheets";
import { EmptyState, PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { appConfig, isModuleEnabled } from "@/config/app.config";
import { electricityOccurrences } from "@/features/bills/electricity";
import { listBillItems, listPayments } from "@/features/bills/queries";
import { commitments, lastDayOf, occurrencesOf, toBillLike, upcoming } from "@/features/bills/upcoming";
import { listAllBills, listMeters, listUnpaidBillsWithDueDate } from "@/features/electricity/queries";
import { attachmentsByOwner } from "@/features/shared/queries";
import { occurrenceDays, toPay, toPayNow } from "@/features/bills/line";
import { addMonths, monthOf } from "@/lib/dates";
import { formatMoney, todayInAppTz } from "@/lib/format";

export const metadata: Metadata = { title: "Bills & subscriptions" };

async function BillsContent({ searchParams }: { searchParams: Promise<{ archived?: string; month?: string }> }) {
  const params = await searchParams;
  const showArchived = params.archived === "1";
  const electricityOn = !showArchived && isModuleEnabled("electricity");
  const [items, archivedItems, unpaidElectricity, electricityMeters, electricityBills] = await Promise.all([
    listBillItems(showArchived),
    listBillItems(true),
    electricityOn ? listUnpaidBillsWithDueDate() : Promise.resolve([]),
    electricityOn ? listMeters(false) : Promise.resolve([]),
    electricityOn ? listAllBills() : Promise.resolve([]),
  ]);
  const files = await attachmentsByOwner("bill_item", items.map((i) => i.id));
  const payments = await listPayments(items.map((i) => i.id));
  const receipts = await attachmentsByOwner("bill_payment", payments.map((p) => p.id));
  const today = todayInAppTz(); // after the queries, which opt this render into request time

  // The summaries cover the active items (the list above the archived view is not shown there).
  const bills = showArchived ? [] : items.map(toBillLike);
  const horizon = appConfig.bills.upcomingDays;
  const thisMonth = monthOf(today);
  const lastMonth = addMonths(thisMonth, appConfig.bills.calendarMonthsAhead);
  const requested = params.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month) ? params.month : thisMonth;
  const month = requested < thisMonth ? thisMonth : requested > lastMonth ? lastMonth : requested;
  // Electricity bills are handled here too (C106, reversing C57): due ones join the list, and each meter's bills have their own group below.
  const electricity = electricityOccurrences(unpaidElectricity, today);
  const inMonth = [...bills.flatMap((b) => occurrencesOf(b, today, lastDayOf(month))), ...electricity].filter((o) => monthOf(o.date) === month);
  const soon = upcoming(bills, electricity, today, horizon);
  // To pay now (S.5): this period's bill of each item plus anything late, not every date in the window.
  const payNow = toPayNow(soon, today);
  const due = toPay(payNow);

  return (
    <>
      {!showArchived ? (
        <>
          <section aria-label="To pay now" className="flex flex-col gap-1 rounded-3xl border border-raised bg-deepest p-4 md:p-5">
            <div className="flex items-baseline font-mono text-[10.5px] tracking-[0.14em] text-label uppercase">
              <span>To pay now</span>
              <span className="ml-auto">This period and anything late</span>
            </div>
            <p className="font-display text-4xl leading-none font-semibold tracking-tight md:text-5xl">{formatMoney(due.cents / 100)}</p>
            <p className="text-sm text-muted-foreground">
              {payNow.length === 0 ? "Nothing to pay right now." : `${payNow.length} payment${payNow.length === 1 ? "" : "s"}`}
              {due.withoutAmount > 0 ? `, ${due.withoutAmount} without an amount` : ""}
            </p>
          </section>
          <NextDaysLine days={occurrenceDays(soon, today, horizon)} windowDays={horizon} title={`Due in the next ${horizon} days`} link={null} />
          <div className="grid gap-4 lg:grid-cols-2">
            <UpcomingList occurrences={soon} today={today} days={horizon} />
            <CommitmentsCard data={commitments(bills)} />
          </div>
          <BillsCalendar
            month={month}
            today={today}
            occurrences={inMonth}
            prevMonth={month > thisMonth ? addMonths(month, -1) : null}
            nextMonth={month < lastMonth ? addMonths(month, 1) : null}
          />
          <ElectricityBills meters={electricityMeters} bills={electricityBills} today={today} />
          <h2 className="mt-2 font-mono text-[10.5px] font-normal tracking-[0.14em] text-label uppercase">All bills and subscriptions</h2>
        </>
      ) : null}

      {!showArchived ? (
        <div>
          <AddBillItemSheet defaultDate={today} />
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title={showArchived ? "Nothing archived" : "Nothing here yet"}
          hint={showArchived ? "Items you archive show up here." : "Add the bills and subscriptions you pay again and again, with their next due date."}
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((item) => (
            <BillItemCard key={item.id} item={item} files={files.get(item.id) ?? []} payments={payments.filter((p) => p.itemId === item.id)} receipts={receipts} today={today} />
          ))}
        </ul>
      )}

      {showArchived ? (
        <Link href="/bills" className="text-sm underline-offset-2 hover:underline">
          ← Back to active items
        </Link>
      ) : archivedItems.length > 0 ? (
        <Link href="/bills?archived=1" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
          Show archived ({archivedItems.length})
        </Link>
      ) : null}
    </>
  );
}

export default function BillsPage(props: PageProps<"/bills">) {
  if (!isModuleEnabled("bills")) notFound();

  return (
    <>
      <PageHeader title="Bills & subscriptions" description="What you pay again and again, and when it is next due." />
      <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" aria-label="Loading bills" />}>
        <BillsContent searchParams={props.searchParams as Promise<{ archived?: string; month?: string }>} />
      </Suspense>
    </>
  );
}
