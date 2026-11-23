import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "@/db/read";
import * as schema from "@/db/schema";
import { demoRows } from "@/db/demo/data";

/**
 * For tests only: an in-memory Postgres (PGlite) built from the same migrations as Supabase and the
 * demo. Never connects anywhere. `seed` fills it with the demo's made-up sample data for `today`.
 */
export async function makeTestDb(seed?: { today: string }): Promise<{ db: Db; client: PGlite }> {
  const client = new PGlite();
  const local = drizzle({ client, schema });
  await migrate(local, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  if (seed) {
    const rows = demoRows(seed.today);
    // Parents before children, as in src/db/demo/index.ts.
    await local.insert(schema.electricityMeters).values(rows.electricityMeters);
    await local.insert(schema.electricityReadings).values(rows.electricityReadings);
    await local.insert(schema.electricityBills).values(rows.electricityBills);
    await local.insert(schema.billItems).values(rows.billItems);
    await local.insert(schema.vehicles).values(rows.vehicles);
    await local.insert(schema.vehicleRenewals).values(rows.vehicleRenewals);
    await local.insert(schema.vehicleServices).values(rows.vehicleServices);
    await local.insert(schema.tasks).values(rows.tasks);
  }
  return { db: local as unknown as Db, client };
}
