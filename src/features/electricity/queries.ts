import "server-only";
import { asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";
import { electricityMeters, electricityReadings } from "@/db/schema";
import { UUID_RE } from "@/features/shared/validation";

/** Active meters, or archived ones, by name. */
export async function listMeters(archived: boolean) {
  await connection();
  return db
    .select()
    .from(electricityMeters)
    .where(archived ? isNotNull(electricityMeters.archivedAt) : isNull(electricityMeters.archivedAt))
    .orderBy(asc(sql`lower(${electricityMeters.name})`));
}

export async function getMeter(id: string) {
  await connection();
  if (!UUID_RE.test(id)) return null;
  const [row] = await db.select().from(electricityMeters).where(eq(electricityMeters.id, id));
  return row ?? null;
}

/** All readings of a meter, newest first. */
export async function listReadings(meterId: string) {
  await connection();
  return db
    .select()
    .from(electricityReadings)
    .where(eq(electricityReadings.meterId, meterId))
    .orderBy(desc(electricityReadings.readingDate), desc(electricityReadings.createdAt));
}

/** Every reading of every meter (newest first), for pages that show several meters at once. */
export async function listAllReadings() {
  await connection();
  return db.select().from(electricityReadings).orderBy(desc(electricityReadings.readingDate), desc(electricityReadings.createdAt));
}
