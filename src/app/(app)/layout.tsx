import { Suspense } from "react";
import { AccessGate } from "@/components/shell/access-gate";
import { AppShell } from "@/components/shell/app-shell";

/** Shell for every page: the desktop rail and the phone bar (C95, DESIGN.md Navigation). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // The gate reads the session, which is request-time data, so it sits inside Suspense (C61).
    <Suspense fallback={null}>
      <AccessGate>
        <AppShell>{children}</AppShell>
      </AccessGate>
    </Suspense>
  );
}
