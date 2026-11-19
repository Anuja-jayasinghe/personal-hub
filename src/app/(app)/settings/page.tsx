import type { Metadata } from "next";
import { Suspense } from "react";
import { ReminderDaysForm } from "@/components/settings/rules-forms";
import { HubFacts, SlabRuleTiles, SubPageList } from "@/components/settings/settings-sections";
import { SettingsSection } from "@/components/settings/settings-ui";
import { PageHeader } from "@/components/shell/page-header";
import { SignOutRow } from "@/components/shell/sign-out-row";
import { ThemeSwitcher } from "@/components/shell/theme-switcher";
import { Skeleton } from "@/components/ui/skeleton";
import { listMeters } from "@/features/electricity/queries";
import { getRules, newestLocalBackup } from "@/features/settings/queries";
import { formatDate, todayInAppTz } from "@/lib/format";

export const metadata: Metadata = { title: "Settings" };

async function SubPageRows() {
  const [meters, backup] = await Promise.all([listMeters(false), newestLocalBackup()]);
  const today = todayInAppTz();
  const backupMeta = !backup ? "None yet" : backup.date === today ? `Today ${backup.time}` : formatDate(backup.date);
  return <SubPageList meters={`${meters.length} ${meters.length === 1 ? "meter" : "meters"}`} backup={backupMeta} />;
}

async function RulesSections() {
  const rules = await getRules();
  return (
    <>
      <SettingsSection label="The slab rule">
        <SlabRuleTiles rules={rules} />
      </SettingsSection>
      <SettingsSection label="Reminders">
        <ReminderDaysForm rules={rules} />
      </SettingsSection>
    </>
  );
}

/**
 * Settings (R.6, board HSettings; S.2b, C107): the look, the sub-pages (phone; desktop has the
 * sub-menu), the slab rule at a glance (changed in Meters and rules), the reminder days, what this hub
 * runs on, and Sign out. Everything that can change is changed here, and nothing here leads out of Settings.
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

      <Suspense fallback={<Skeleton className="h-56 rounded-2xl" />}>
        <RulesSections />
      </Suspense>

      <SettingsSection label="This hub">
        <HubFacts />
      </SettingsSection>

      <SignOutRow />
    </>
  );
}
