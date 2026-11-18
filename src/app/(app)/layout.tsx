import { Suspense } from "react";
import { AccessGate } from "@/components/shell/access-gate";
import { Logo } from "@/components/brand/logo";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { appConfig } from "@/config/app.config";

/** Shell for every page: collapsible sidebar on desktop (button inside it), slide-out panel on phones (C30, C77). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // The gate reads the session, which is request-time data, so it sits inside Suspense (C61).
    <Suspense fallback={null}>
      <AccessGate>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            {/* Phones only: the panel slides out, so its button stays up here. On a larger screen the
                button lives inside the sidebar itself (C77) and there is no top bar. */}
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 md:hidden">
              <SidebarTrigger aria-label="Open navigation" />
              <Logo size={22} decorative />
              <span className="font-semibold tracking-tight">{appConfig.name}</span>
            </header>
            <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 md:p-6">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </AccessGate>
    </Suspense>
  );
}
