import { Suspense } from "react";
import { HomeView } from "@/components/home/home-view";
import { Skeleton } from "@/components/ui/skeleton";
import { loadHome } from "@/features/home/load";

/**
 * Home (issue #218, C157): read everything at request time, then draw it. The reading is `loadHome()` (the same
 * queries as before the redesign, through `readDb()`, so visitors see the demo and a person with limited access only
 * what they may see); the drawing is `HomeView`.
 */
async function HomeContent() {
  return <HomeView data={await loadHome()} />;
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-4 md:gap-5" aria-label="Loading Home">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-3xl md:h-[360px]" />
          <Skeleton className="h-64 w-full rounded-3xl" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
