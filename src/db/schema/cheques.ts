import { sql } from "drizzle-orm";
import { check, date, index, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./_columns";

export const CHEQUE_STATUSES = ["waiting", "deposited", "cleared", "bounced", "cancelled"] as const;
export type ChequeStatus = (typeof CHEQUE_STATUSES)[number];

/**
 * Cheques the owner has received (issue #178, DECISIONS C158). `cheque_date` is the earliest day the
 * cheque can be deposited (the date written on it); it goes stale six months after that date. `amount` is
 * LKR (C21). `from_party` is who gave it. `cheque_number` is optional personal financial data: it is shown
 * only on the owner's own page and never appears in a notice, a reminder title, an error or a URL. The
 * photos of the cheque are attachments with owner type `cheque` (private bucket). Owners only: there is
 * no access area for it. Row-level security on (C27).
 */
export const cheques = pgTable(
  "cheques",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromParty: text("from_party").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    bank: text("bank"),
    chequeNumber: text("cheque_number"),
    chequeDate: date("cheque_date", { mode: "string" }).notNull(),
    note: text("note"),
    status: text("status").$type<ChequeStatus>().notNull().default("waiting"),
    depositedOn: date("deposited_on", { mode: "string" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("cheques_status_date_idx").on(t.status, t.chequeDate),
    check("cheques_status_check", sql`${t.status} in ('waiting', 'deposited', 'cleared', 'bounced', 'cancelled')`),
    check("cheques_amount_check", sql`${t.amount} > 0`),
    check("cheques_from_check", sql`char_length(${t.fromParty}) between 1 and 80`),
    // A waiting cheque has not been deposited; a deposited or cleared one has a deposit date.
    check("cheques_deposit_date_check", sql`${t.status} <> 'waiting' or ${t.depositedOn} is null`),
    check("cheques_deposited_has_date_check", sql`${t.status} not in ('deposited', 'cleared') or ${t.depositedOn} is not null`),
  ],
).enableRLS();

export type Cheque = typeof cheques.$inferSelect;
export type NewCheque = typeof cheques.$inferInsert;
