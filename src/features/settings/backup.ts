/**
 * Numbers for Settings › Data and backup (R.6, board HSettingsMore). Pure, so they are easy to test.
 */

const BACKUP_NAME = /^personal-hub-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.zip$/;

export type BackupStamp = { file: string; date: string; time: string };

/**
 * The newest backup among the file names in the backups folder. `pnpm backup` names its files
 * `personal-hub-YYYYMMDD-HHMMSS.zip` in this computer's time, so the name alone says when it was made.
 * Other files are ignored. Null when there is none.
 */
export function latestBackup(names: readonly string[]): BackupStamp | null {
  let best: BackupStamp | null = null;
  for (const file of names) {
    const m = BACKUP_NAME.exec(file);
    if (!m) continue;
    const stamp = { file, date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` };
    if (!best || `${stamp.date} ${file}` > `${best.date} ${best.file}`) best = stamp;
  }
  return best;
}

/** Share of the storage allowance used, from 0 to 1 (capped), for the line on the page. */
export function storageShare(usedBytes: number, allowanceBytes: number): number {
  if (allowanceBytes <= 0 || usedBytes <= 0) return 0;
  return Math.min(1, usedBytes / allowanceBytes);
}
