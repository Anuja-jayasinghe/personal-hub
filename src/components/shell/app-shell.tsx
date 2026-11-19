import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { AccountMenu } from "@/components/shell/account-menu";
import { CurrentNavLinks } from "@/components/shell/app-nav";
import { phoneBarItems, railItems } from "@/components/shell/nav";
import { NavLinks } from "@/components/shell/nav-links";
import { OfflineBanner } from "@/components/shell/offline-banner";

/**
 * The app frame (DESIGN.md, Navigation; boards HubRail and HubNav):
 * - desktop (md and up): an 88px rail on the left with the J mark, labelled links and your account;
 * - phone: a bar fixed to the bottom with Home, Vehicles, Electricity, Bills and More.
 * It replaces the collapsible sidebar and the slide-out panel (C30, C77; see C95).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const rail = railItems();
  const bar = phoneBarItems();
  return (
    <div className="flex min-h-svh flex-1 flex-col">
      <aside
        aria-label="Main"
        className="fixed inset-y-0 left-0 z-30 hidden w-[88px] flex-col items-center gap-1.5 border-r border-sidebar-border bg-sidebar py-5 md:flex"
      >
        <Logo size={40} />
        <span className="h-5" aria-hidden />
        <nav aria-label="Sections" className="flex flex-col items-center gap-1.5">
          <Suspense fallback={<NavLinks items={rail} pathname={null} variant="rail" />}>
            <CurrentNavLinks items={rail} variant="rail" />
          </Suspense>
        </nav>
        <div className="mt-auto">
          <AccountMenu />
        </div>
      </aside>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pt-7 md:pb-10 md:pl-[calc(88px+2.25rem)] md:pr-9">
        <OfflineBanner />
        {children}
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
