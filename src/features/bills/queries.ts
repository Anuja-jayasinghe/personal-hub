import "server-only";
import { asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";
import { billItems } from "@/db/schema";
import { UUID_RE } from "@/features/shared/validation";

/** Active bills and subscriptions (or archived ones), soonest due first; finished one-offs last. */
export async function listBillItems(archived: boolean) {
  await connection();
  return db
    .select()
    .from(billItems)
    .where(archived ? isNotNull(billItems.archivedAt) : isNull(billItems.archivedAt))
    .orderBy(sql`${billItems.nextDueDate} asc nulls last`, asc(sql`lower(${billItems.name})`));
}

export async function getBillItem(id: string) {
  await connection();
  if (!UUID_RE.test(id)) return null;
  const [row] = await db.select().from(billItems).where(eq(billItems.id, id));
  return row ?? null;
}
