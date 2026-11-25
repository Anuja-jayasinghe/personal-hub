import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Server-only database client (DECISIONS C19: no Supabase key or connection string ever reaches
 * the browser). Connects through Supabase's session pooler (port 5432) using DATABASE_URL, locally (C26)
 * and on Vercel (C119: the transaction pooler, port 6543, hung once a connection carried more than two
 * queries at a time, and every page sends about ten).
 *
 * The connection is created on first use, not when this file is imported. That way
 * `pnpm build` and the tests work on a brand-new computer before `.env.local` exists (found by
 * the fresh-clone rehearsal for step 0.9); a missing DATABASE_URL only fails when a query runs.
 */
/** The pool size: `DATABASE_MAX_CONNECTIONS` when it is a whole number from 1 to 40, else 1 on Vercel and 5 locally. */
export function maxConnections(env: { DATABASE_MAX_CONNECTIONS?: string; VERCEL?: string } = process.env): number {
  const set = Number(env.DATABASE_MAX_CONNECTIONS);
  if (Number.isInteger(set) && set >= 1 && set <= 40) return set;
  return env.VERCEL ? 1 : 5;
}

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
      // On Vercel each server copy keeps one connection to the session pooler (C119), which queues a
      // page's queries on it. Prepared statements stay off (needed for a pooler in transaction mode).
      // Locally: up to 5. `DATABASE_MAX_CONNECTIONS` overrides this (issue #257): the transaction pooler
      // (port 6543) hangs when queries queue on ONE connection but is fine with one query per connection,
      // so with that address set it to about 12 (see HOSTING.md). Unset, nothing changes.
      max: maxConnections(),
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
