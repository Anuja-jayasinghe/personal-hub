import "server-only";
import { eq } from "drizzle-orm";
import { readDb } from "@/db/read";
import { vehicleOdometerReadings, vehicleServices } from "@/db/schema";
import { toPoints, type OdometerPoint } from "./odometer";

/**
 * Every dated odometer value of a vehicle (readings and services with an odometer), for checking
 * that a new one fits. Pass the id of the reading or service being edited to leave it out.
 */
export async function loadOdometerPoints(vehicleId: string, except?: { readingId?: string; serviceId?: string }): Promise<OdometerPoint[]> {
  const db = await readDb();
  const [readings, services] = await Promise.all([
    db.select().from(vehicleOdometerReadings).where(eq(vehicleOdometerReadings.vehicleId, vehicleId)),
    db.select().from(vehicleServices).where(eq(vehicleServices.vehicleId, vehicleId)),
  ]);
  return toPoints(
    readings.filter((r) => r.id !== except?.readingId),
    services.filter((s) => s.id !== except?.serviceId),
  );
}
