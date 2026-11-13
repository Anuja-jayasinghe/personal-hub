import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BillItemCard } from "@/components/bills/bill-item-card";
import { BillItemForm } from "@/components/bills/bill-item-form";
import { BillsCalendar } from "@/components/bills/bills-calendar";
import { CommitmentsCard } from "@/components/bills/commitments-card";
import { UpcomingList } from "@/components/bills/upcoming-list";
import { EmptyState, PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { appConfig, isModuleEnabled } from "@/config/app.config";
import { createBillItem } from "@/features/bills/actions";
import { electricityOccurrences } from "@/features/bills/electricity";
import { listBillItems, listPayments } from "@/features/bills/queries";
import { commitments, lastDayOf, occurrencesOf, toBillLike, upcoming } from "@/features/bills/upcoming";
import { listUnpaidBillsWithDueDate } from "@/features/electricity/queries";
import { attachmentsByOwner } from "@/features/shared/queries";
import { addMonths, monthOf } from "@/lib/dates";
import { todayInAppTz } from "@/lib/format";

export const metadata: Metadata = { title: "Bills & subscriptions" };

async function BillsContent({ searchParams }: { searchParams: Promise<{ archived?: string; month?: string }> }) {
  const params = await searchParams;
  const showArchived = params.archived === "1";
  const [items, archivedItems, unpaidElectricity] = await Promise.all([
    listBillItems(showArchived),
    listBillItems(true),
    showArchived || !isModuleEnabled("electricity") ? Promise.resolve([]) : listUnpaidBillsWithDueDate(),
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
  // Unpaid electricity bills are shown read-only (C57): they are managed on the Electricity page.
  const electricity = electricityOccurrences(unpaidElectricity, today);
  const inMonth = [...bills.flatMap((b) => occurrencesOf(b, today, lastDayOf(month))), ...electricity].filter((o) => monthOf(o.date) === month);

  return (
    <>
      {!showArchived ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <UpcomingList occurrences={upcoming(bills, electricity, today, horizon)} today={today} days={horizon} />
            <CommitmentsCard data={commitments(bills)} />
          </div>
          <BillsCalendar
            month={month}
            today={today}
            occurrences={inMonth}
            prevMonth={month > thisMonth ? addMonths(month, -1) : null}
            nextMonth={month < lastMonth ? addMonths(month, 1) : null}
          />
          <h2 className="mt-2 text-lg font-medium">All bills and subscriptions</h2>
        </>
      ) : null}

      {!showArchived ? (
        <details className="rounded-lg border">
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">Add a bill or subscription</summary>
          <div className="border-t p-4">
            <BillItemForm action={createBillItem} defaultDate={today} />
          </div>
        </details>
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
