import { RowMeta } from "@/components/settings/settings-ui";
import { storageShare, type BackupStamp } from "@/features/settings/backup";
import { formatBytes, formatDate } from "@/lib/format";

/** The panels on Settings › Data and backup (R.6, board HSettingsMore). Display only; the page reads the data. */

export function Command({ children }: { children: string }) {
  return <code className="rounded-md border bg-background px-1.5 py-0.5 font-mono text-[12px] text-foreground">{children}</code>;
}

export function BackupStatus({ backup, today }: { backup: BackupStamp | null; today: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-3">
        <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${backup ? "bg-status-ok" : "bg-status-soon-mark"}`} />
        <p className="text-[15px] font-semibold">
          {backup ? (
            <>
              Last copy {backup.date === today ? "today" : formatDate(backup.date)} at <span className="font-mono">{backup.time}</span>
            </>
          ) : (
            "No backup on this computer yet"
          )}
        </p>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Run <Command>pnpm backup</Command> on this computer. It writes one zip of every table and every file into the <code className="font-mono">backups/</code>{" "}
        folder, and <Command>pnpm backup:restore</Command> puts one back (see BACKUP.md). A backup holds your real data: keep it somewhere safe and never share
        it.
      </p>
    </div>
  );
}

export function StorageLine({ files, bytes, allowance }: { files: number; bytes: number; allowance: number }) {
  const share = storageShare(bytes, allowance);
  const pct = Math.max(share * 100, bytes > 0 ? 1 : 0);
  const allowanceLabel = allowance >= 1024 ** 3 ? `${Math.round((allowance / 1024 ** 3) * 10) / 10} GB` : formatBytes(allowance);
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <p className="flex items-baseline gap-2">
        <span className="font-display text-2xl leading-none font-semibold">{formatBytes(bytes)}</span>
        <RowMeta>of {allowanceLabel}</RowMeta>
        <span className="ml-auto text-xs text-muted-foreground">
          {files} {files === 1 ? "file" : "files"}
        </span>
      </p>
      <div role="img" aria-label={`${formatBytes(bytes)} used of the ${allowanceLabel} allowance`} className="relative h-3">
        <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-border" />
        <span className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-card bg-primary" style={{ left: `${pct}%` }} />
        <span className="absolute top-1/2 right-0 size-2.5 -translate-y-1/2 rounded-full border-2 border-quiet bg-card" />
      </div>
      <p className="text-xs text-muted-foreground">Documents and photos you attach, in the private file store.</p>
    </div>
  );
}
