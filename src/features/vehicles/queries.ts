import "server-only";
import { asc, count, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";
import { vehicles } from "@/db/schema";
import { UUID_RE } from "@/features/shared/validation";

/** Active vehicles, or archived ones (sold; hidden, no reminders, history kept: DECISIONS C48). */
export async function listVehicles(archived: boolean) {
  await connection();
  return db
    .select()
    .from(vehicles)
    .where(archived ? isNotNull(vehicles.archivedAt) : isNull(vehicles.archivedAt))
    .orderBy(asc(sql`lower(${vehicles.nickname})`));
}

export async function countArchivedVehicles(): Promise<number> {
  await connection();
  const [row] = await db.select({ n: count() }).from(vehicles).where(isNotNull(vehicles.archivedAt));
  return row?.n ?? 0;
}

/** One vehicle by id, or null when the id is not a uuid or nothing matches. */
export async function getVehicle(id: string) {
  await connection();
  if (!UUID_RE.test(id)) return null;
  const [row] = await db.select().from(vehicles).where(eq(vehicles.id, id));
  return row ?? null;
}
