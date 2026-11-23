import "server-only";
import { eq } from "drizzle-orm";
import { readDb } from "@/db/read";
import { vehicleOdometerReadings, vehicleRenewals, vehicles, vehicleServices } from "@/db/schema";
import { pointKey, toPoints, unfitKeys, type OdometerPoint } from "./odometer";
import { carriesOdometer } from "./renewal-validate";

/**
 * The dated odometer values of a vehicle that fit its history (readings, services and emission tests
 * with an odometer, issue #181), for checking that a new typed reading fits. Values that don't fit are
 * left out, so a misread certificate never blocks a correct reading. Pass the id of the reading being
 * edited to leave it out.
 */
export async function loadOdometerPoints(vehicleId: string, except?: { readingId?: string; serviceId?: string }): Promise<OdometerPoint[]> {
  const db = await readDb();
  const [readings, services, renewals, [vehicle]] = await Promise.all([
    db.select().from(vehicleOdometerReadings).where(eq(vehicleOdometerReadings.vehicleId, vehicleId)),
    db.select().from(vehicleServices).where(eq(vehicleServices.vehicleId, vehicleId)),
    db.select().from(vehicleRenewals).where(eq(vehicleRenewals.vehicleId, vehicleId)),
    db.select({ ignore: vehicles.ignoreEmissionOdometer }).from(vehicles).where(eq(vehicles.id, vehicleId)),
  ]);
  const points = toPoints(
    readings.filter((r) => r.id !== except?.readingId),
    services.filter((s) => s.id !== except?.serviceId),
    vehicle?.ignore ? [] : renewals.filter((r) => carriesOdometer(r.type)),
  );
  const unfit = unfitKeys(points);
  return points.filter((p) => !unfit.has(pointKey(p)));
}
