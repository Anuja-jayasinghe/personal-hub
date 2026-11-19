import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Server-only database client (DECISIONS C19: no Supabase key or connection string ever reaches
 * the browser). Connects through the Supabase pooler using DATABASE_URL: the session pooler locally (C26),
 * the transaction pooler on Vercel (C115).
 *
 * The connection is created on first use, not when this file is imported. That way
 * `pnpm build` and the tests work on a brand-new computer before `.env.local` exists (found by
 * the fresh-clone rehearsal for step 0.9); a missing DATABASE_URL only fails when a query runs.
 */
function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  }

  // Reuse one connection pool across hot reloads in development.
  const globalForDb = globalThis as unknown as { __pgClient?: ReturnType<typeof postgres> };
  const client =
    globalForDb.__pgClient ??
    postgres(connectionString, {
      // On Vercel each server copy keeps one connection and uses Supabase's transaction pooler
      // (port 6543), which needs prepared statements off (hosting prep, C115). Locally: up to 5.
      max: process.env.VERCEL ? 1 : 5,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 15,
    });
  if (process.env.NODE_ENV !== "production") globalForDb.__pgClient = client;

  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;

let instance: Db | undefined;

/** The database. Looks like a plain Drizzle client (`db.select()...`); connects on first use. */
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    instance ??= createDb();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
