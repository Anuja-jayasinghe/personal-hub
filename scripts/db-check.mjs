// Sanity check for the database (run: pnpm db:check). Safe to re-run: it cleans up after itself.
//   1. connects through DATABASE_URL (Supabase session pooler)
//   2. confirms every public table has row-level security on (DECISIONS C27)
//   3. writes + reads + deletes one app_settings row
//   4. confirms the public "anon" role (the Data API path) sees no rows
import postgres from "postgres";

try {
  process.loadEnvFile(".env.local");
} catch {
  // DATABASE_URL may already be set in the environment.
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FAIL  DATABASE_URL is not set (see .env.example)");
  process.exit(1);
}

const sql = postgres(url, { max: 1, connect_timeout: 15 });
let failed = false;
const ok = (msg) => console.log(`PASS  ${msg}`);
const bad = (msg) => {
  failed = true;
  console.log(`FAIL  ${msg}`);
};

try {
  const [{ now }] = await sql`select now()`;
  ok(`connected (server time ${now.toISOString()})`);

  const tables = await sql`
    select c.relname as name, c.relrowsecurity as rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname`;
  if (tables.length === 0) bad("no tables in public schema (run pnpm db:migrate)");
  for (const t of tables) (t.rls ? ok : bad)(`RLS ${t.rls ? "on" : "OFF"}: public.${t.name}`);

  const key = `__db_check_${Date.now()}`;
  await sql`insert into app_settings (key, value) values (${key}, ${sql.json({ hello: "world" })})`;
  const [row] = await sql`select value from app_settings where key = ${key}`;
  (row?.value?.hello === "world" ? ok : bad)("write + read app_settings row");

  // What the public Data API role would see: must be nothing.
  const anonCount = await sql.begin(async (tx) => {
    await tx`set local role anon`;
    const [{ count }] = await tx`select count(*)::int as count from app_settings`;
    return count;
  });
  (anonCount === 0 ? ok : bad)(`anon role sees ${anonCount} rows (expected 0)`);

  await sql`delete from app_settings where key = ${key}`;
  const [{ left }] = await sql`select count(*)::int as left from app_settings where key = ${key}`;
  (left === 0 ? ok : bad)("cleanup: test row removed");
} catch (err) {
  bad(`error: ${err.message}`);
} finally {
  await sql.end({ timeout: 5 });
}

process.exit(failed ? 1 : 0);
