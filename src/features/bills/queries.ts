import "server-only";
import { asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { connection } from "next/server";
import { readDb, type Db } from "@/db/read";
import { billItems, billPayments } from "@/db/schema";
import { UUID_RE } from "@/features/shared/validation";

/**
 * Active bills and subscriptions (or archived ones), soonest due first; finished one-offs last.
 * `from` is only passed by the daily notification run, which has no signed-in person and must read the
 * real database (src/features/notifications/run.ts); pages leave it out and get `readDb()`.
 */
export async function listBillItems(archived: boolean, from?: Db) {
  await connection();
  const db = from ?? (await readDb());
  return db
    .select()
    .from(billItems)
    .where(archived ? isNotNull(billItems.archivedAt) : isNull(billItems.archivedAt))
    .orderBy(sql`${billItems.nextDueDate} asc nulls last`, asc(sql`lower(${billItems.name})`));
}

export async function getBillItem(id: string) {
  await connection();
  const db = await readDb();
  if (!UUID_RE.test(id)) return null;
  const [row] = await db.select().from(billItems).where(eq(billItems.id, id));
  return row ?? null;
}

/** Payments of the given items, newest first. */
export async function listPayments(itemIds: string[]) {
  await connection();
  const db = await readDb();
  if (itemIds.length === 0) return [];
  return db
    .select()
    .from(billPayments)
    .where(inArray(billPayments.itemId, itemIds))
    .orderBy(desc(billPayments.paidDate), desc(billPayments.createdAt));
}
