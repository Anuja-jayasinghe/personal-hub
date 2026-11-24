import { Suspense } from "react";
import { AccessGate } from "@/components/shell/access-gate";
import { AppShell } from "@/components/shell/app-shell";
import { GestureLayer } from "@/components/shell/gesture-layer";

/** Shell for every page: the desktop rail and the phone bar (C95, DESIGN.md Navigation). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Touch gestures (issue #176, C156): edge swipes and pull to refresh in the installed app, tab swipes on a vehicle. Delete this line to switch them all off. */}
      <GestureLayer />
      {/* The gate reads the session, which is request-time data, so it sits inside Suspense (C61). */}
      <Suspense fallback={null}>
        <AccessGate>
          <AppShell>{children}</AppShell>
        </AccessGate>
      </Suspense>
    </>
  );
}
