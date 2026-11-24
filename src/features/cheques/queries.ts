import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { readDb, type Db } from "@/db/read";
import { cheques } from "@/db/schema";

/**
 * Every cheque, newest cheque date last within each status (the page groups and sorts them). Owners only
 * (the page and the reminder source both check). `from` is only passed by the daily notification run,
 * which has no signed-in person and must read the real database; pages leave it out and get `readDb()`.
 */
export async function listCheques(from?: Db) {
  await connection();
  const db = from ?? (await readDb());
  return db.select().from(cheques).orderBy(asc(cheques.chequeDate), desc(cheques.createdAt));
}

/** Only the cheques still waiting to be deposited: the ones that remind. */
export async function listWaitingCheques(from?: Db) {
  await connection();
  const db = from ?? (await readDb());
  return db.select().from(cheques).where(eq(cheques.status, "waiting")).orderBy(asc(cheques.chequeDate));
}
