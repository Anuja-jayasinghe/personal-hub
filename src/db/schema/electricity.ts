import { check, date, index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createdAt, updatedAt } from "./_columns";

/**
 * Electricity meters (Phase 2.1; DECISIONS C52: two consumption meters, tracked separately).
 * Archiving hides a meter without deleting its history. Row-level security on (C27).
 */
export const electricityMeters = pgTable(
  "electricity_meters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    accountNumber: text("account_number"),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("electricity_meters_archived_idx").on(t.archivedAt)],
).enableRLS();

/**
 * One cumulative kWh total per reading (C53). `source` records who entered it, so the import
 * from the automation project can be added later (C54). A "meter replaced" entry stores the old
 * meter's final reading in `replaced_final_value`; its `value` is the new meter's starting value,
 * and usage carries on across the swap (see src/features/electricity/usage.ts).
 */
export const electricityReadings = pgTable(
  "electricity_readings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meterId: uuid("meter_id")
      .notNull()
      .references(() => electricityMeters.id, { onDelete: "cascade" }),
    /** Calendar day of the reading, "YYYY-MM-DD". */
    readingDate: date("reading_date", { mode: "string" }).notNull(),
    value: numeric("value", { precision: 12, scale: 2 }).notNull(),
    source: text("source").$type<"manual" | "auto">().notNull().default("manual"),
    note: text("note"),
    replacedFinalValue: numeric("replaced_final_value", { precision: 12, scale: 2 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("electricity_readings_meter_date_idx").on(t.meterId, t.readingDate),
    check("electricity_readings_value_check", sql`${t.value} >= 0`),
    check("electricity_readings_replaced_check", sql`${t.replacedFinalValue} is null or ${t.replacedFinalValue} >= 0`),
    check("electricity_readings_source_check", sql`${t.source} in ('manual', 'auto')`),
  ],
).enableRLS();

export type ElectricityMeter = typeof electricityMeters.$inferSelect;
export type ElectricityReading = typeof electricityReadings.$inferSelect;
