import type { Metadata } from "next";
import { Suspense } from "react";
import { BackupStatus, StorageLine } from "@/components/settings/backup-panels";
import { SettingsSection } from "@/components/settings/settings-ui";
import { PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { appConfig } from "@/config/app.config";
import { EXPORTS, type ExportKey } from "@/features/settings/exports";
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
 * (BACKUP.md); this page says when the last one was made, lets you download spreadsheet copies (S.7, C113)
 * and shows how much is stored. Nothing here changes data.
 */
/** The downloads, grouped as on the page: Electricity, Bills, Vehicles. */
const groups = Object.entries(
  Object.entries(EXPORTS).reduce<Record<string, [string, (typeof EXPORTS)[ExportKey]][]>>((acc, [key, e]) => {
    (acc[e.group] ??= []).push([key, e]);
    return acc;
  }, {}),
);

export default function DataAndBackupPage() {
  return (
    <>
      <PageHeader title="Data and backup" parent={{ href: "/settings", label: "Settings" }} />

      <SettingsSection label="Backups">
        <Suspense fallback={<Skeleton className="h-32 rounded-2xl" />}>
          <BackupPanel />
        </Suspense>
      </SettingsSection>

      <SettingsSection label="Download a copy" note="Spreadsheet files (CSV) of what is in the hub right now, archived records included. Photos and documents are only in the full backup.">
        <div className="grid gap-3 sm:grid-cols-3">
          {groups.map(([group, items]) => (
            <div key={group} className="flex flex-col gap-1 rounded-2xl border bg-card p-3">
              <span className="px-1 pb-1 font-mono text-[10.5px] tracking-[0.14em] text-label uppercase">{group}</span>
              {items.map(([key, e]) => (
                <a
                  key={key}
                  href={`/settings/backup/export/${key}`}
                  download
                  className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex-1">{e.label}</span>
                  <span className="font-mono text-[10px] tracking-[0.12em] text-primary">CSV ↓</span>
                </a>
              ))}
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection label="Files stored">
        <Suspense fallback={<Skeleton className="h-28 rounded-2xl" />}>
          <StoragePanel />
        </Suspense>
      </SettingsSection>
    </>
  );
}
