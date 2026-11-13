import { sql } from "drizzle-orm";
import { check, date, index, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./_columns";
import { billItems } from "./bill-items";

/**
 * Payment history of a bill or subscription (Phase 3.2). Recording a payment also moves the
 * item's next due date forward (see src/features/bills/payments.ts), so `due_date` keeps the date
 * the payment settled. `amount` is what was actually paid (LKR, C21); it may be empty. Deleting an
 * item deletes its payments (CASCADE); the payments' receipts (attachments owned by
 * `bill_payment`) are removed by the application first. Row-level security on (C27).
 */
export const billPayments = pgTable(
  "bill_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => billItems.id, { onDelete: "cascade" }),
    /** The day it was paid, "YYYY-MM-DD". */
    paidDate: date("paid_date", { mode: "string" }).notNull(),
    /** The due date this payment settled. */
    dueDate: date("due_date", { mode: "string" }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("bill_payments_item_idx").on(t.itemId, t.paidDate),
    check("bill_payments_amount_check", sql`${t.amount} is null or ${t.amount} >= 0`),
  ],
).enableRLS();

export type BillPayment = typeof billPayments.$inferSelect;
export type NewBillPayment = typeof billPayments.$inferInsert;
