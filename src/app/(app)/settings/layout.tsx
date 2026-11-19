import { Suspense } from "react";
import { requirePage } from "@/lib/auth";
import { SettingsMenu, SettingsMenuLinks } from "@/components/settings/settings-menu";

/** Settings and its sub-pages: on desktop a 224px sub-menu sits on the left (DESIGN.md, Layout; board HSettings). */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  // Settings and Admin are the owner's only (S.8, C114).
  await requirePage("owner");
  return (
    <div className="flex flex-col gap-6 md:grid md:grid-cols-[224px_minmax(0,1fr)] md:items-start md:gap-9">
      <nav aria-label="Settings" className="hidden md:sticky md:top-7 md:block md:pt-14">
        <Suspense fallback={<SettingsMenuLinks pathname={null} />}>
          <SettingsMenu />
        </Suspense>
      </nav>
      <div className="flex max-w-2xl min-w-0 flex-col gap-6">{children}</div>
    </div>
  );
}
