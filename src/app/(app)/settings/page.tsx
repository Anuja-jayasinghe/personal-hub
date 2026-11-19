import type { Metadata } from "next";
import { Suspense } from "react";
import { configFileNote, HubFacts, PartsList, SlabRuleTiles, SubPageList } from "@/components/settings/settings-sections";
import { SettingsSection } from "@/components/settings/settings-ui";
import { PageHeader } from "@/components/shell/page-header";
import { SignOutRow } from "@/components/shell/sign-out-row";
import { ThemeSwitcher } from "@/components/shell/theme-switcher";
import { listMeters } from "@/features/electricity/queries";
import { newestLocalBackup } from "@/features/settings/queries";
import { formatDate, todayInAppTz } from "@/lib/format";

export const metadata: Metadata = { title: "Settings" };

async function SubPageRows() {
  const [meters, backup] = await Promise.all([listMeters(false), newestLocalBackup()]);
  const today = todayInAppTz();
  const backupMeta = !backup ? "None yet" : backup.date === today ? `Today ${backup.time}` : formatDate(backup.date);
  return <SubPageList meters={`${meters.length} ${meters.length === 1 ? "meter" : "meters"}`} backup={backupMeta} />;
}

/**
 * Settings (R.6, board HSettings): the look, the sub-pages (phone; desktop has the sub-menu), the slab
 * rule at a glance, the parts of the hub and Sign out. Everything but the look is read-only here:
 * it lives in app.config.ts.
 */
export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />

      <SettingsSection label="Look">
        <ThemeSwitcher />
      </SettingsSection>

      <div className="md:hidden">
        <SettingsSection label="More settings">
          <Suspense fallback={<SubPageList />}>
            <SubPageRows />
          </Suspense>
        </SettingsSection>
      </div>

      <SettingsSection label="The slab rule">
        <SlabRuleTiles />
      </SettingsSection>

      <SettingsSection label="Parts of the hub" note={configFileNote("Parts are switched on and off in")}>
        <PartsList />
      </SettingsSection>

      <SettingsSection label="This hub" note={configFileNote("Read-only. These values live in")}>
        <HubFacts />
      </SettingsSection>

      <SignOutRow />
    </>
  );
}
