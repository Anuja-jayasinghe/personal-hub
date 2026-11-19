import type { Metadata } from "next";
import { Suspense } from "react";
import { BackupStatus, Command, StorageLine } from "@/components/settings/backup-panels";
import { RowCard, Row, RowMeta, SettingsSection } from "@/components/settings/settings-ui";
import { PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { appConfig } from "@/config/app.config";
import { newestLocalBackup, storageUsed } from "@/features/settings/queries";
import { todayInAppTz } from "@/lib/format";

export const metadata: Metadata = { title: "Data and backup" };

async function BackupPanel() {
  const backup = await newestLocalBackup();
  return <BackupStatus backup={backup} today={todayInAppTz()} />;
}

async function StoragePanel() {
  const { files, bytes } = await storageUsed();
  return <StorageLine files={files} bytes={bytes} allowance={appConfig.storage.allowanceBytes} />;
}

/**
 * Settings › Data and backup (R.6, board HSettingsMore). Backups and exports run on this computer
 * (BACKUP.md); this page says when the last one was made and how much is stored. Nothing here changes data.
 */
export default function DataAndBackupPage() {
  return (
    <>
      <PageHeader title="Data and backup" parent={{ href: "/settings", label: "Settings" }} />

      <SettingsSection label="Backups">
        <Suspense fallback={<Skeleton className="h-32 rounded-2xl" />}>
          <BackupPanel />
        </Suspense>
      </SettingsSection>

      <SettingsSection label="Take a copy" note="Exports go into a new folder under exports/ and backups into backups/. Neither is ever committed.">
        <RowCard>
          <Row label="Electricity readings and bills" hint={<Command>pnpm export:electricity</Command>} end={<RowMeta>CSV</RowMeta>} />
          <Row label="Everything, with documents" hint={<Command>pnpm backup</Command>} end={<RowMeta>ZIP</RowMeta>} />
        </RowCard>
      </SettingsSection>

      <SettingsSection label="Files stored">
        <Suspense fallback={<Skeleton className="h-28 rounded-2xl" />}>
          <StoragePanel />
        </Suspense>
      </SettingsSection>
    </>
  );
}
