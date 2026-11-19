import "server-only";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { count, sum } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";
import { attachments } from "@/db/schema";
import { latestBackup, type BackupStamp } from "./backup";

/** How many files are stored and their total size in bytes (Settings › Data and backup). */
export async function storageUsed(): Promise<{ files: number; bytes: number }> {
  await connection();
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
