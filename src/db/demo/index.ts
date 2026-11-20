import "server-only";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { todayInAppTz } from "@/lib/format";
import { demoRows } from "./data";

/**
 * The demo database (S.9, DECISIONS C118): an in-memory Postgres (PGlite) inside this server, built
 * from the same migrations as the real one and filled with sample data. It never connects to
 * Supabase, so nothing real can show up in the demo, and nothing written here is kept.
 *
 * One copy per server instance, rebuilt when the day changes so the sample dates stay around today.
 */

let current: { day: string; db: Promise<Db> } | undefined;

async function build(day: string): Promise<Db> {
  const client = new PGlite();
  const demo = drizzle({ client, schema });
  await migrate(demo, { migrationsFolder: path.join(process.cwd(), "drizzle") });

  const rows = demoRows(day);
  // Parents before children, so the foreign keys hold.
  await demo.insert(schema.electricityMeters).values(rows.electricityMeters);
  await demo.insert(schema.electricityReadings).values(rows.electricityReadings);
  await demo.insert(schema.electricityBills).values(rows.electricityBills);
  await demo.insert(schema.electricityLiveSwitches).values(rows.electricityLiveSwitches);
  await demo.insert(schema.billItems).values(rows.billItems);
  await demo.insert(schema.billPayments).values(rows.billPayments);
  await demo.insert(schema.vehicles).values(rows.vehicles);
  await demo.insert(schema.vehicleRenewals).values(rows.vehicleRenewals);
  await demo.insert(schema.vehicleServices).values(rows.vehicleServices);
  await demo.insert(schema.vehicleOdometerReadings).values(rows.vehicleOdometerReadings);
  await demo.insert(schema.tasks).values(rows.tasks);
  await demo.insert(schema.notes).values(rows.notes);

  // Same query builder as the real client; the pages only read through it, so the two drivers'
  // differences (raw `execute` results) never come up.
  return demo as unknown as Db;
}

export function demoDb(): Promise<Db> {
  const day = todayInAppTz();
  if (!current || current.day !== day) {
    const db = build(day);
    current = { day, db };
    // A failed build is not kept, so the next request tries again.
    db.catch(() => {
      if (current?.db === db) current = undefined;
    });
  }
  return current.db;
}
