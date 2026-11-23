import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePage } from "@/lib/auth";

async function OwnerCheck({ children }: { children: React.ReactNode }) {
  await requirePage("owner");
  return <>{children}</>;
}

/**
 * Wraps a whole Settings page (S.8, C114; review of #198): nothing inside renders, and none of its data
 * is read, until the person is known to be an owner; anyone else gets "not found". The Settings layout
 * checks this too, but a partial page request can render a page without its layout. Inside `<Suspense>`
 * so the check never blocks a navigation between Settings pages (the result is memoised per request).
 */
export function OwnerOnly({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Skeleton className="h-40 rounded-2xl" />}>
      <OwnerCheck>{children}</OwnerCheck>
    </Suspense>
  );
}
