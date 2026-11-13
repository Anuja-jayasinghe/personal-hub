import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Server-only database client (DECISIONS C19: no Supabase key or connection string ever reaches
 * the browser). Connects through the Supabase session pooler (C26) using DATABASE_URL.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

// Reuse one connection pool across hot reloads in development.
const globalForDb = globalThis as unknown as { __pgClient?: ReturnType<typeof postgres> };

const client =
  globalForDb.__pgClient ??
  postgres(connectionString, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
  });

if (process.env.NODE_ENV !== "production") globalForDb.__pgClient = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
