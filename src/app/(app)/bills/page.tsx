import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BillItemCard } from "@/components/bills/bill-item-card";
import { BillItemForm } from "@/components/bills/bill-item-form";
import { EmptyState, PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { isModuleEnabled } from "@/config/app.config";
import { createBillItem } from "@/features/bills/actions";
import { listBillItems } from "@/features/bills/queries";
import { attachmentsByOwner } from "@/features/shared/queries";
import { todayInAppTz } from "@/lib/format";

export const metadata: Metadata = { title: "Bills & subscriptions" };

async function BillsContent({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const showArchived = (await searchParams).archived === "1";
  const [items, archivedItems] = await Promise.all([listBillItems(showArchived), listBillItems(true)]);
  const files = await attachmentsByOwner("bill_item", items.map((i) => i.id));
  const today = todayInAppTz(); // after the queries, which opt this render into request time

  return (
    <>
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
            <BillItemCard key={item.id} item={item} files={files.get(item.id) ?? []} today={today} />
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
        <BillsContent searchParams={props.searchParams as Promise<{ archived?: string }>} />
      </Suspense>
    </>
  );
}
