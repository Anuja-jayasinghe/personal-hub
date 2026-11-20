import { Suspense } from "react";
import { requirePage } from "@/lib/auth";
import { SettingsGrid } from "@/components/settings/settings-grid";
import { SettingsMenu, SettingsMenuLinks } from "@/components/settings/settings-menu";

/** Settings and its sub-pages, the owner's only (S.8, C114), in the Settings grid with the sub-menu. */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requirePage("owner");
  return (
    <SettingsGrid
      menu={
        <Suspense fallback={<SettingsMenuLinks pathname={null} />}>
          <SettingsMenu />
        </Suspense>
      }
    >
      {children}
    </SettingsGrid>
  );
}
