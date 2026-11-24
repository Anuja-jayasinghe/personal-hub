import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AddChequeSheet } from "@/components/cheques/cheque-sheets";
import { ChequesView } from "@/components/cheques/cheques-view";
import { PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { isModuleEnabled } from "@/config/app.config";
import { listCheques } from "@/features/cheques/queries";
import { attachmentsByOwner } from "@/features/shared/queries";
import { requirePage } from "@/lib/auth";
import { todayInAppTz } from "@/lib/format";

export const metadata: Metadata = { title: "Cheques" };

async function ChequesContent() {
  // Money: owners only. Everyone else (a shared person, the demo, a signed-out visitor) gets "not found".
  await requirePage("owner");
  const rows = await listCheques();
  const photos = await attachmentsByOwner("cheque", rows.map((r) => r.id));
  const today = todayInAppTz(); // after the queries, which opt this render into request time

  return (
    <>
      <PageHeader title="Cheques" description="Cheques you have received, and when each can be deposited." actions={<AddChequeSheet today={today} />} />
      <ChequesView rows={rows} photos={photos} today={today} />
    </>
  );
}

export default function ChequesPage() {
  if (!isModuleEnabled("cheques")) notFound();

  // The title and the Add button are drawn inside the content, after the owner check: nobody else sees even the page's name.
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" aria-label="Loading" />}>
      <ChequesContent />
    </Suspense>
  );
}
