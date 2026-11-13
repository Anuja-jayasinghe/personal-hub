import "server-only";
import { asc, count, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";
import { vehicleServices, vehicles } from "@/db/schema";
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

/** A vehicle's service records, newest first. */
export async function listServices(vehicleId: string) {
  await connection();
  return db
    .select()
    .from(vehicleServices)
    .where(eq(vehicleServices.vehicleId, vehicleId))
    .orderBy(desc(vehicleServices.serviceDate), desc(vehicleServices.createdAt));
}

/** Every service record of every ACTIVE (not archived) vehicle, with the vehicle's nickname. For reminders. */
export async function listServicesOfActiveVehicles() {
  await connection();
  return db
    .select({
      id: vehicleServices.id,
      vehicleId: vehicleServices.vehicleId,
      nickname: vehicles.nickname,
      serviceDate: vehicleServices.serviceDate,
      serviceType: vehicleServices.serviceType,
      nextDueDate: vehicleServices.nextDueDate,
      createdAt: vehicleServices.createdAt,
    })
    .from(vehicleServices)
    .innerJoin(vehicles, eq(vehicles.id, vehicleServices.vehicleId))
    .where(isNull(vehicles.archivedAt));
}
