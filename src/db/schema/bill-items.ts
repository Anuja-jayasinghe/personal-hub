import { sql } from "drizzle-orm";
import { boolean, check, date, index, numeric, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./_columns";

/**
 * Things you pay again and again: bills and subscriptions (Phase 3.1, DECISIONS C56 to C59).
 * `next_due_date` is the date the next payment is due; marking a payment paid moves it forward by
 * the frequency (3.2). `anchor_day` remembers the day of the month the item is really due, so a
 * bill due on the 31st goes Jan 31, Feb 28, Mar 31 instead of drifting to the 28th. A finished
 * one-off item has no next due date. Amounts are LKR (C21), `amount` is the usual amount (bills
 * vary). `payment_method` is a free-text label such as "Visa, Sampath": card numbers are never
 * stored (the validator refuses anything that looks like one). Row-level security on (C27).
 */
export const billItems = pgTable(
  "bill_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").$type<"bill" | "subscription">().notNull().default("bill"),
    name: text("name").notNull(),
    frequency: text("frequency").$type<"weekly" | "monthly" | "quarterly" | "yearly" | "one_off">().notNull(),
    nextDueDate: date("next_due_date", { mode: "string" }),
    anchorDay: smallint("anchor_day"),
    amount: numeric("amount", { precision: 12, scale: 2 }),
    autopay: boolean("autopay").notNull().default(false),
    paymentMethod: text("payment_method"),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("bill_items_archived_idx").on(t.archivedAt),
    check("bill_items_kind_check", sql`${t.kind} in ('bill', 'subscription')`),
    check("bill_items_frequency_check", sql`${t.frequency} in ('weekly', 'monthly', 'quarterly', 'yearly', 'one_off')`),
    check("bill_items_anchor_day_check", sql`${t.anchorDay} is null or ${t.anchorDay} between 1 and 31`),
    check("bill_items_amount_check", sql`${t.amount} is null or ${t.amount} >= 0`),
    // Only a finished one-off item may have no next due date.
    check("bill_items_due_check", sql`${t.frequency} = 'one_off' or ${t.nextDueDate} is not null`),
  ],
).enableRLS();

export type BillItem = typeof billItems.$inferSelect;
export type NewBillItem = typeof billItems.$inferInsert;
