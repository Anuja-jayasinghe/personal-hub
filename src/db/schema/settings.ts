import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Key/value app settings (reminder lead-time overrides, tariff toggles, ...).
 * Conventions for every table (PLAN.md step 0.5): uuid ids, timestamptz columns, and row-level
 * security enabled in the same migration (DECISIONS C27).
 */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}).enableRLS();

export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;
