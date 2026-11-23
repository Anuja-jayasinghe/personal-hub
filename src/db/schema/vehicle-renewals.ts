import { check, date, index, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createdAt, updatedAt } from "./_columns";
import { vehicles } from "./vehicles";

/**
 * Renewals that expire (Phase 1.3): revenue license, insurance, emission test. The type is
 * validated against the list in app.config.ts rather than a database check, so adding a type
 * needs no migration. Documents hang off a renewal as attachments with owner type
 * "vehicle_renewal".
 *
 * Renewing (DECISIONS C46) keeps history: the old record gets `renewed_at` and a new record is
 * added. The "current" renewal of a vehicle and type is the not-renewed one with the latest
 * expiry; only that one feeds Reminders. Deleting a vehicle deletes its renewals (CASCADE); the
 * renewals' files are removed by the application first. Row-level security on (C27).
 */
export const vehicleRenewals = pgTable(
  "vehicle_renewals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider"),
    /**
     * UNUSED since issue #189: the policy, licence or certificate number is on the attached scan, so the
     * hub no longer asks for it or shows it. Kept because a migration here may only add.
     */
    referenceNumber: text("reference_number"),
    /** Calendar day the cover or licence starts, "YYYY-MM-DD". */
    startDate: date("start_date", { mode: "string" }),
    /** Calendar day it expires, "YYYY-MM-DD". Feeds Reminders while the record is current. */
    expiryDate: date("expiry_date", { mode: "string" }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }),
    /**
     * For an emission test: the odometer printed on the certificate, read on the test day (the start
     * date). It is a point on the vehicle's mileage timeline, combined in code like a service's
     * odometer, so it is never typed twice (issue #181).
     */
    odometerKm: integer("odometer_km"),
    /** Set when this record was renewed; the new record carries on from here. */
    renewedAt: timestamp("renewed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("vehicle_renewals_vehicle_expiry_idx").on(t.vehicleId, t.expiryDate),
    check("vehicle_renewals_amount_check", sql`${t.amount} is null or ${t.amount} >= 0`),
    check("vehicle_renewals_odometer_check", sql`${t.odometerKm} is null or ${t.odometerKm} >= 0`),
    check("vehicle_renewals_dates_check", sql`${t.startDate} is null or ${t.startDate} <= ${t.expiryDate}`),
  ],
).enableRLS();

export type VehicleRenewal = typeof vehicleRenewals.$inferSelect;
export type NewVehicleRenewal = typeof vehicleRenewals.$inferInsert;
