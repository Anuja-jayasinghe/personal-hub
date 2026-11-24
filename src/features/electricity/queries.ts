import "server-only";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { connection } from "next/server";
import { readDb, type Db } from "@/db/read";
import { electricityBills, electricityLiveSwitches, electricityMeters, electricityReadings } from "@/db/schema";
import { UUID_RE } from "@/features/shared/validation";

/** The database a query reads: the one passed in (the daily run: the real one, no request needed), else the signed-in person's through `readDb()`. */
async function dbFor(from?: Db): Promise<Db> {
  if (from) return from;
  await connection();
  return readDb();
}

/** Active meters, or archived ones, by name. */
export async function listMeters(archived: boolean, from?: Db) {
  const db = await dbFor(from);
  return db
    .select()
    .from(electricityMeters)
    .where(archived ? isNotNull(electricityMeters.archivedAt) : isNull(electricityMeters.archivedAt))
    .orderBy(asc(sql`lower(${electricityMeters.name})`));
}

export async function getMeter(id: string) {
  await connection();
  const db = await readDb();
  if (!UUID_RE.test(id)) return null;
  const [row] = await db.select().from(electricityMeters).where(eq(electricityMeters.id, id));
  return row ?? null;
}

/** All readings of a meter, newest first. */
export async function listReadings(meterId: string) {
  await connection();
  const db = await readDb();
  return db
    .select()
    .from(electricityReadings)
    .where(eq(electricityReadings.meterId, meterId))
    .orderBy(desc(electricityReadings.readingDate), desc(electricityReadings.createdAt));
}

/** Every reading of every meter (newest first), for pages that show several meters at once. */
export async function listAllReadings(from?: Db) {
  const db = await dbFor(from);
  return db.select().from(electricityReadings).orderBy(desc(electricityReadings.readingDate), desc(electricityReadings.createdAt));
}

/** Every bill of every meter, newest first. */
export async function listAllBills(from?: Db) {
  const db = await dbFor(from);
  return db.select().from(electricityBills).orderBy(desc(electricityBills.billDate), desc(electricityBills.createdAt));
}

/** Unpaid bills that have a due date, with their meter's name, for the reminders (archived meters included: an unpaid bill is still owed). */
export async function listUnpaidBillsWithDueDate(from?: Db) {
  await connection();
  const db = from ?? (await readDb());
  return db
    .select({
      id: electricityBills.id,
      meterId: electricityBills.meterId,
      meterName: electricityMeters.name,
      accountNumber: electricityMeters.accountNumber,
      billDate: electricityBills.billDate,
      dueDate: electricityBills.dueDate,
      amount: electricityBills.amount,
    })
    .from(electricityBills)
    .innerJoin(electricityMeters, eq(electricityMeters.id, electricityBills.meterId))
    .where(and(isNull(electricityBills.paidDate), isNotNull(electricityBills.dueDate)));
}

/** Every switch of the house between meters, newest first (issue #69). Small: one row per switch. */
export async function listLiveSwitches() {
  await connection();
  const db = await readDb();
  return db.select().from(electricityLiveSwitches).orderBy(desc(electricityLiveSwitches.switchedOn), desc(electricityLiveSwitches.createdAt));
}
