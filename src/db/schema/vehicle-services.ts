import { check, date, index, integer, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createdAt, updatedAt } from "./_columns";
import { vehicles } from "./vehicles";

/**
 * Service records (Phase 1.2): what was done to a vehicle, when, where and for how much, plus the
 * date the next service is due. Reminders are by DATE only (DECISIONS C24); the odometer is
 * optional history. Deleting a vehicle deletes its services (ON DELETE CASCADE). Row-level
 * security on (C27).
 *
 * `service_type` is free text; app.config.ts offers a list of suggestions. Reminders treat each
 * distinct type (case-insensitively) as its own cycle: the latest record of a type decides
 * whether anything is due for that type.
 */
export const vehicleServices = pgTable(
  "vehicle_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    /** Calendar day the service was done, "YYYY-MM-DD". */
    serviceDate: date("service_date", { mode: "string" }).notNull(),
    serviceType: text("service_type").notNull(),
    garage: text("garage"),
    odometerKm: integer("odometer_km"),
    cost: numeric("cost", { precision: 12, scale: 2 }),
    itemsDone: text("items_done"),
    /** When the next service of this type is due, "YYYY-MM-DD". Feeds Reminders. */
    nextDueDate: date("next_due_date", { mode: "string" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("vehicle_services_vehicle_date_idx").on(t.vehicleId, t.serviceDate),
    check("vehicle_services_odometer_check", sql`${t.odometerKm} is null or ${t.odometerKm} >= 0`),
    check("vehicle_services_cost_check", sql`${t.cost} is null or ${t.cost} >= 0`),
    check("vehicle_services_next_due_check", sql`${t.nextDueDate} is null or ${t.nextDueDate} >= ${t.serviceDate}`),
  ],
).enableRLS();

export type VehicleService = typeof vehicleServices.$inferSelect;
export type NewVehicleService = typeof vehicleServices.$inferInsert;
