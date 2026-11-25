import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Server-only database client (DECISIONS C19: no Supabase key or connection string ever reaches
 * the browser). It works through either of Supabase's poolers, chosen by the port of DATABASE_URL:
 *  - the session pooler (5432, locally and migrations, C26): one connection per server copy, which only
 *    15 clients can hold at once (issue #253);
 *  - the transaction pooler (6543, the live site from v1.0.0, issue #278, C168): many more clients, but it
 *    hangs when queries queue on ONE connection (C119), so the driver is told to send one query at a time per
 *    connection (`max_pipeline: 1`); tested 2026-11-25: 100 concurrent queries on 8 connections in 0.9 s.
 *
 * The connection is created on first use, not when this file is imported. That way
 * `pnpm build` and the tests work on a brand-new computer before `.env.local` exists (found by
 * the fresh-clone rehearsal for step 0.9); a missing DATABASE_URL only fails when a query runs.
 */
/** True when the connection string is Supabase's transaction pooler (port 6543). Anything unparsable counts as no. */
export function usesTransactionPooler(connectionString: string | undefined): boolean {
  if (!connectionString) return false;
  try {
    return new URL(connectionString).port === "6543";
  } catch {
    return false;
  }
}

/**
 * The pool size: `DATABASE_MAX_CONNECTIONS` when it is a whole number from 1 to 40, else 4 on the transaction pooler
 * (a connection only holds a database slot while a query runs there), 1 on Vercel and 5 locally on the session pooler.
 */
export function maxConnections(env: Record<string, string | undefined> = process.env, transactionPooler = false): number {
  const set = Number(env.DATABASE_MAX_CONNECTIONS);
  if (Number.isInteger(set) && set >= 1 && set <= 40) return set;
  if (transactionPooler) return 4;
  return env.VERCEL ? 1 : 5;
}

function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  }

  const transactionPooler = usesTransactionPooler(connectionString);

  // Reuse one connection pool across hot reloads in development.
  const globalForDb = globalThis as unknown as { __pgClient?: ReturnType<typeof postgres> };
  const client =
    globalForDb.__pgClient ??
    postgres(connectionString, {
      // Session pooler: on Vercel each server copy keeps one connection (queued queries share it); locally up
      // to 5. Transaction pooler: a few connections per copy, one query at a time on each (see above).
      // `DATABASE_MAX_CONNECTIONS` overrides the size. Prepared statements stay off (needed on both).
      max: maxConnections(process.env, transactionPooler),
      // The transaction pooler hangs when queries queue on one connection; one at a time is safe at any load.
      max_pipeline: transactionPooler ? 1 : 100,
      prepare: false,
      // The session pooler allows only 15 clients in all (issue #253), so on Vercel an idle copy gives its
      // connection back after 4 seconds instead of 20; the next request simply reconnects. Locally: 20.
      idle_timeout: process.env.VERCEL ? 4 : 20,
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
