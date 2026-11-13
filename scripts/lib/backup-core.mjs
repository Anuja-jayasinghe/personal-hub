// Shared helpers for scripts/backup.mjs and scripts/restore.mjs (issue #4, DECISIONS C42-C43).
// Plain Node, no TypeScript, so it runs the same on macOS, Windows and Linux.
import { createHash } from "node:crypto";

export const BUCKET = "attachments";
export const FORMAT_VERSION = 1;

export const sha256 = (data) => createHash("sha256").update(data).digest("hex");

/** Double-quotes a SQL identifier. Table names come from the database catalog, never from input. */
export const quoteIdent = (name) => `"${String(name).replace(/"/g, '""')}"`;

export function loadEnv() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Variables may already be set in the environment.
  }
  const missing = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_SECRET_KEY"].filter((n) => !process.env[n]);
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.join(", ")}. Create .env.local first (see SETUP.md) and run pnpm setup:check.`);
  }
}

/** Opens the database and storage clients. Dates are always read and written in UTC. */
export async function openClients() {
  const { default: postgres } = await import("postgres");
  const { createClient } = await import("@supabase/supabase-js");
  const sql = postgres(process.env.DATABASE_URL, {
    max: 1,
    connect_timeout: 15,
    connection: { TimeZone: "UTC" },
  });
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { sql, supabase };
}

/** Names of the app's tables (the public schema). */
export async function listPublicTables(sql) {
  const rows = await sql`
    select tablename from pg_tables where schemaname = 'public' order by tablename`;
  return rows.map((r) => r.tablename);
}

/**
 * Exports one table as JSON text, rows ordered by the first column so the output is
 * deterministic. Returned as text so it is written byte-for-byte as the database produced it.
 */
export async function exportTable(sql, table) {
  const [row] = await sql.unsafe(
    `select coalesce(json_agg(t), '[]'::json)::text as json, count(*)::int as rows
     from (select * from ${quoteIdent(table)} order by 1) t`,
  );
  return { json: row.json, rows: row.rows };
}

/** Foreign keys between app tables, as { child, parent } (the child holds the reference). */
export async function listForeignKeys(sql) {
  return sql`
    select child.relname as child, parent.relname as parent
    from pg_constraint c
    join pg_class child on child.oid = c.conrelid
    join pg_class parent on parent.oid = c.confrelid
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace and c.conrelid <> c.confrelid`;
}

/**
 * Orders tables so every table comes after the tables it references (parents first), otherwise
 * alphabetically. Restore inserts in this order and deletes in the reverse order. Throws if the
 * foreign keys form a loop, because then no order works without deferring constraints.
 */
export function orderByDependencies(tables, edges) {
  const remaining = new Set(tables);
  const parentsOf = new Map(tables.map((t) => [t, new Set()]));
  for (const { child, parent } of edges) {
    if (remaining.has(child) && remaining.has(parent)) parentsOf.get(child).add(parent);
  }
  const ordered = [];
  while (remaining.size > 0) {
    const ready = [...remaining].filter((t) => [...parentsOf.get(t)].every((p) => !remaining.has(p))).sort();
    if (ready.length === 0) {
      throw new Error(`Foreign keys form a loop between: ${[...remaining].sort().join(", ")}. This restore cannot order them automatically.`);
    }
    ordered.push(ready[0]); // one at a time keeps the result stable and alphabetical where free
    remaining.delete(ready[0]);
  }
  return ordered;
}

export async function countMigrations(sql) {
  try {
    const [{ n }] = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
    return n;
  } catch {
    return 0;
  }
}

/** Every file in the bucket, with folders walked recursively. */
export async function listObjects(supabase, prefix = "", out = []) {
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: pageSize, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`Could not list files in "${prefix || "/"}": ${error.message}`);
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) await listObjects(supabase, path, out); // a folder
      else out.push(path);
    }
    if (data.length < pageSize) break;
  }
  return out;
}

export async function downloadObject(supabase, path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw new Error(`Could not download "${path}": ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function removeAllObjects(supabase) {
  const paths = await listObjects(supabase);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    if (error) throw new Error(`Could not delete files: ${error.message}`);
  }
  return paths.length;
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Date-time stamp for file names, in this computer's local time: 20261113-143502. */
export function timestamp(now = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}
