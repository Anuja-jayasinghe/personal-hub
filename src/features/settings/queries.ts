import "server-only";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { count, eq, sum } from "drizzle-orm";
import { cache } from "react";
import { connection } from "next/server";
import { readDb } from "@/db/read";
import { appSettings, attachments } from "@/db/schema";
import { latestBackup, type BackupStamp } from "./backup";
import { mergeRules, RULES_KEY, type HubRules } from "./rules";

/** How many files are stored and their total size in bytes (Settings › Data and backup). */
export async function storageUsed(): Promise<{ files: number; bytes: number }> {
  await connection();
  const db = await readDb();
  const [row] = await db.select({ files: count(), bytes: sum(attachments.sizeBytes) }).from(attachments);
  return { files: row?.files ?? 0, bytes: Number(row?.bytes ?? 0) };
}

/**
 * The newest `pnpm backup` file in this computer's `backups/` folder, read by name only (the file is
 * never opened). Null when the folder is missing, which is also the case once the app is hosted.
 */
export async function newestLocalBackup(): Promise<BackupStamp | null> {
  await connection();
  try {
    return latestBackup(await readdir(path.join(process.cwd(), "backups")));
  } catch {
    return null;
  }
}

/**
 * The rules in force (S.2b, C107): what is saved in Settings laid over the defaults in app.config.ts.
 * Read once per request; every page that works with limits, meter checks or reminders calls this.
 */
export const getRules = cache(async (): Promise<HubRules> => {
  await connection();
  const db = await readDb();
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, RULES_KEY));
  return mergeRules(row?.value ?? null);
});
