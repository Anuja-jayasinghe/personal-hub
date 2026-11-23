import { boolean, check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createdAt, updatedAt } from "./_columns";
import { attachments } from "./shared";

/**
 * Vehicles (Phase 1.1). Services, renewals, fixes, notes and files hang off a vehicle by its id
 * (shared tasks, notes and attachments use owner_type "vehicle"). Row-level security on (C27).
 *
 * Fuel type is validated against the list in app.config.ts rather than a database check, so
 * adding a fuel type needs no migration. A vehicle is archived (C48) by setting `archived_at`;
 * archived vehicles are hidden and send no reminders but keep their history.
 */
export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nickname: text("nickname").notNull(),
    registrationNumber: text("registration_number"),
    make: text("make"),
    model: text("model"),
    year: integer("year"),
    fuelType: text("fuel_type"),
    /** The kind of vehicle (a key of `appConfig.vehicles.types`: car, suv, motorbike...). Picks its icon. */
    vehicleType: text("vehicle_type"),
    /**
     * LEGACY and unused: the old single, undated odometer value. Mileage now lives in dated
     * readings (vehicle_odometer_readings). Kept only because a migration here may only add.
     */
    odometerKm: integer("odometer_km"),
    /**
     * The vehicle's cover photo (C47): one attachment whose owner is this vehicle. If that file is
     * deleted the pointer is cleared automatically (ON DELETE SET NULL).
     */
    coverAttachmentId: uuid("cover_attachment_id").references(() => attachments.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    /**
     * Set when this vehicle's emission certificates print an inaccurate odometer (issue #184): its
     * emission tests are then not asked for one and stay off the mileage timeline, which uses only
     * services and readings typed on the Odometer section.
     */
    ignoreEmissionOdometer: boolean("ignore_emission_odometer").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("vehicles_archived_idx").on(t.archivedAt),
    check("vehicles_year_check", sql`${t.year} is null or ${t.year} between 1886 and 2100`),
    check("vehicles_odometer_check", sql`${t.odometerKm} is null or ${t.odometerKm} >= 0`),
  ],
).enableRLS();

export type Vehicle = typeof vehicles.$inferSelect;
export type NewVehicle = typeof vehicles.$inferInsert;
