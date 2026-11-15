import "server-only";
import { asc, count, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";
import { vehicleOdometerReadings, vehicleRenewals, vehicleServices, vehicles } from "@/db/schema";
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

/** A vehicle's renewals, latest expiry first (current and past; split with renewal-logic). */
export async function listRenewals(vehicleId: string) {
  await connection();
  return db
    .select()
    .from(vehicleRenewals)
    .where(eq(vehicleRenewals.vehicleId, vehicleId))
    .orderBy(desc(vehicleRenewals.expiryDate), desc(vehicleRenewals.createdAt));
}

/** Every renewal of every ACTIVE (not archived) vehicle, with the vehicle's nickname. For reminders. */
export async function listRenewalsOfActiveVehicles() {
  await connection();
  return db
    .select({
      id: vehicleRenewals.id,
      vehicleId: vehicleRenewals.vehicleId,
      nickname: vehicles.nickname,
      type: vehicleRenewals.type,
      expiryDate: vehicleRenewals.expiryDate,
      renewedAt: vehicleRenewals.renewedAt,
      createdAt: vehicleRenewals.createdAt,
    })
    .from(vehicleRenewals)
    .innerJoin(vehicles, eq(vehicles.id, vehicleRenewals.vehicleId))
    .where(isNull(vehicles.archivedAt));
}

/** Raw figures for a vehicle's Overview tab; the page turns them into text with the pure helpers. */
export async function getVehicleSummary(vehicleId: string) {
  await connection();
  const [services, renewals] = await Promise.all([
    db
      .select()
      .from(vehicleServices)
      .where(eq(vehicleServices.vehicleId, vehicleId))
      .orderBy(desc(vehicleServices.serviceDate), desc(vehicleServices.createdAt)),
    db
      .select()
      .from(vehicleRenewals)
      .where(eq(vehicleRenewals.vehicleId, vehicleId))
      .orderBy(desc(vehicleRenewals.expiryDate), desc(vehicleRenewals.createdAt)),
  ]);
  return { services, renewals };
}

/** A vehicle's dated odometer readings, newest first. (Services with an odometer count too: see odometer.ts.) */
export async function listOdometerReadings(vehicleId: string) {
  await connection();
  return db
    .select()
    .from(vehicleOdometerReadings)
    .where(eq(vehicleOdometerReadings.vehicleId, vehicleId))
    .orderBy(desc(vehicleOdometerReadings.readingDate), desc(vehicleOdometerReadings.createdAt));
}
