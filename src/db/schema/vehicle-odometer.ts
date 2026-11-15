import { sql } from "drizzle-orm";
import { check, date, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./_columns";
import { vehicles } from "./vehicles";

/**
 * Dated odometer readings of a vehicle. Each one says "on this day the odometer showed this", so
 * an old value is never mistaken for the current one. A service record that has an odometer counts
 * as a reading too (it is combined in code, see src/features/vehicles/odometer.ts), so nothing is
 * typed twice. Replaces the single undated `vehicles.odometer_km`, which stays in the table unused
 * (a migration here only adds). Deleting a vehicle deletes its readings (CASCADE). Row-level
 * security on (C27).
 */
export const vehicleOdometerReadings = pgTable(
  "vehicle_odometer_readings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    /** The day the odometer was read, "YYYY-MM-DD". */
    readingDate: date("reading_date", { mode: "string" }).notNull(),
    km: integer("km").notNull(),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("vehicle_odometer_vehicle_idx").on(t.vehicleId, t.readingDate),
    check("vehicle_odometer_km_check", sql`${t.km} >= 0`),
  ],
).enableRLS();

export type VehicleOdometerReading = typeof vehicleOdometerReadings.$inferSelect;
export type NewVehicleOdometerReading = typeof vehicleOdometerReadings.$inferInsert;
