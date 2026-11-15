import { check, date, index, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createdAt, updatedAt } from "./_columns";
import { electricityMeters } from "./electricity";

/**
 * Monthly electricity bills (Phase 2.2). A bill belongs to a meter and records the readings the
 * utility used, the units billed, the amount (LKR, C21), the due date and, once paid, the paid
 * date (C55). Units normally equal current minus previous reading, but are stored because a
 * replaced meter makes that subtraction meaningless. Deleting a meter deletes its bills (CASCADE).
 * Bills carry no documents (C74). Row-level security on (C27).
 */
export const electricityBills = pgTable(
  "electricity_bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meterId: uuid("meter_id")
      .notNull()
      .references(() => electricityMeters.id, { onDelete: "cascade" }),
    /** Date printed on the bill, "YYYY-MM-DD". */
    billDate: date("bill_date", { mode: "string" }).notNull(),
    /** Date the meter was read for this bill. The since-last-bill calculator starts from here. */
    readingDate: date("reading_date", { mode: "string" }).notNull(),
    previousReading: numeric("previous_reading", { precision: 12, scale: 2 }).notNull(),
    currentReading: numeric("current_reading", { precision: 12, scale: 2 }).notNull(),
    units: numeric("units", { precision: 12, scale: 2 }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }),
    dueDate: date("due_date", { mode: "string" }),
    /** Set when the bill has been paid. Unpaid bills with a due date feed Reminders. */
    paidDate: date("paid_date", { mode: "string" }),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("electricity_bills_meter_date_idx").on(t.meterId, t.billDate),
    check("electricity_bills_readings_check", sql`${t.previousReading} >= 0 and ${t.currentReading} >= 0`),
    check("electricity_bills_units_check", sql`${t.units} >= 0`),
    check("electricity_bills_amount_check", sql`${t.amount} is null or ${t.amount} >= 0`),
    check("electricity_bills_due_check", sql`${t.dueDate} is null or ${t.dueDate} >= ${t.billDate}`),
  ],
).enableRLS();

export type ElectricityBill = typeof electricityBills.$inferSelect;
