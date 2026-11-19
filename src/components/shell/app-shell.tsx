import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { CurrentNavLinks } from "@/components/shell/app-nav";
import { phoneBarItems, railBottomItems, railItems } from "@/components/shell/nav";
import { NavLinks } from "@/components/shell/nav-links";
import { OfflineBanner } from "@/components/shell/offline-banner";

/**
 * The app frame (DESIGN.md, Navigation; boards HubRail and HubNav):
 * - desktop (md and up): a 72px rail on the left with the J mark (a link to Home), icon-only links and
 *   Settings pinned to the bottom (S.1); your profile sits at the top right of each page header;
 * - phone: a bar fixed to the bottom with Home, Vehicles, Electricity, Bills and More.
 * It replaces the collapsible sidebar and the slide-out panel (C30, C77; see C95).
 * The content area uses the width of the window (issue #105), so it fits at 80% to 110% browser zoom.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const rail = railItems();
  const railBottom = railBottomItems();
  const bar = phoneBarItems();
  return (
    <div className="flex min-h-svh flex-1 flex-col">
      <aside
        aria-label="Main"
        className="fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col items-center gap-1.5 border-r border-sidebar-border bg-sidebar py-5 md:flex"
      >
        <Link href="/" aria-label="hub, go to Home" className="rounded-lg p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo size={36} decorative />
        </Link>
        <span className="h-4" aria-hidden />
        <nav aria-label="Sections" className="flex flex-col items-center gap-1.5">
          <Suspense fallback={<NavLinks items={rail} pathname={null} variant="rail" />}>
            <CurrentNavLinks items={rail} variant="rail" />
          </Suspense>
        </nav>
        <nav aria-label="Settings" className="mt-auto flex flex-col items-center">
          <Suspense fallback={<NavLinks items={railBottom} pathname={null} variant="rail" />}>
            <CurrentNavLinks items={railBottom} variant="rail" />
          </Suspense>
        </nav>
      </aside>

      {/* Desktop: the content starts right after the rail, padded 28 × 36 px as on the boards, and uses the
          width up to 1600 px, centred in what is left on very wide windows (issue #105: it used to be a
          fixed ~860 px column, which looked oversized at 100% zoom and lost in space at 80%). */}
      <main className="flex w-full flex-1 flex-col px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pt-7 md:pr-9 md:pb-10 md:pl-[calc(72px+2.25rem)]">
        <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6">
          <OfflineBanner />
          {children}
        </div>
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-deepest/90 px-2.5 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
        style={{ gridTemplateColumns: `repeat(${bar.length}, minmax(0, 1fr))` }}
      >
        <Suspense fallback={<NavLinks items={bar} pathname={null} variant="bar" />}>
          <CurrentNavLinks items={bar} variant="bar" />
        </Suspense>
      </nav>
    </div>
  );
}
