import { Suspense } from "react";
import { AccessGate } from "@/components/shell/access-gate";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { appConfig } from "@/config/app.config";

/** Shell for every page: collapsible sidebar on desktop, slide-out panel on phones (C30). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // The gate reads the session, which is request-time data, so it sits inside Suspense (C61).
    <Suspense fallback={null}>
      <AccessGate>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger aria-label="Toggle navigation" />
              <span className="font-medium md:hidden">{appConfig.name}</span>
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
