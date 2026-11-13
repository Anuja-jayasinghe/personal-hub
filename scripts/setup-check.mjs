// Setup check (run: pnpm setup:check). Run it on any computer after cloning and creating .env.local.
// It reports what is missing and how to fix it. It never prints secret values.
//
//   1. Node version
//   2. .env.local and the three required variables (names only; flags leftover placeholders)
//   3. DATABASE_URL looks right (session pooler, not the IPv6-only direct host)
//   4. database reachable, all migrations applied, row-level security on for every table
//   5. file storage reachable and the "attachments" bucket is private
import { readFileSync } from "node:fs";

let failed = 0;
let warned = 0;
const ok = (m) => console.log(`PASS  ${m}`);
const warn = (m) => {
  warned++;
  console.log(`WARN  ${m}`);
};
const bad = (m, fix) => {
  failed++;
  console.log(`FAIL  ${m}`);
  if (fix) console.log(`      fix: ${fix}`);
};

// ---- 1. Node ----------------------------------------------------------------------------------
const nodeMajor = Number(process.versions.node.split(".")[0]);
(nodeMajor >= 22 ? ok : (m) => bad(m, "install Node.js 22 or newer (Windows: winget install OpenJS.NodeJS.LTS)"))(
  `Node.js ${process.versions.node}${nodeMajor >= 22 ? "" : " is too old (22 or newer needed)"}`,
);

// ---- 2. Environment ---------------------------------------------------------------------------
try {
  process.loadEnvFile(".env.local");
  ok(".env.local found");
} catch {
  bad(
    ".env.local not found in this folder",
    "copy .env.example to .env.local and fill it in (see SETUP.md). Run this check from the project folder.",
  );
}

const required = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_SECRET_KEY"];
let envReady = true;
for (const name of required) {
  const value = process.env[name];
  if (!value) {
    envReady = false;
    bad(`${name} is not set`, `add ${name}=... to .env.local (see .env.example)`);
  } else if (/[<>]/.test(value)) {
    envReady = false;
    bad(`${name} still contains a <placeholder>`, `replace the <...> parts of ${name} in .env.local with real values`);
  } else {
    ok(`${name} is set`);
  }
}

if (!envReady) {
  console.log("\nFix the problems above, then run pnpm setup:check again.");
  process.exit(1);
}

// Anything printed below is scrubbed of the secret values, just in case a library echoes them.
const secrets = [process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_DB_PASSWORD].filter(Boolean);
try {
  const pw = decodeURIComponent(new URL(process.env.DATABASE_URL).password);
  if (pw) secrets.push(pw);
} catch {
  // reported below
}
const scrub = (text) => secrets.reduce((t, s) => t.split(s).join("[hidden]"), String(text));

// ---- 3. DATABASE_URL shape --------------------------------------------------------------------
let dbUrl;
try {
  dbUrl = new URL(process.env.DATABASE_URL);
} catch {
  bad("DATABASE_URL is not a valid URL", "it should look like postgresql://postgres.<project-ref>:<password>@aws-0-...pooler.supabase.com:5432/postgres. If the password has special characters, URL-encode them.");
}
if (dbUrl) {
  if (/^db\.[a-z0-9]+\.supabase\.co$/.test(dbUrl.hostname)) {
    warn("DATABASE_URL uses the direct host, which is IPv6-only; it fails on networks without IPv6. Use the session pooler address from .env.example.");
  } else if (dbUrl.hostname.endsWith("pooler.supabase.com")) {
    ok("DATABASE_URL uses the Supabase session pooler");
  } else {
    warn("DATABASE_URL host is not a Supabase pooler address; double-check it against .env.example.");
  }
  if (!dbUrl.username.startsWith("postgres.")) {
    warn('DATABASE_URL user should look like "postgres.<project-ref>" when using the pooler.');
  }
}

// ---- 4. Database ------------------------------------------------------------------------------
function dbHint(message) {
  if (/password authentication failed/i.test(message)) return "the database password is wrong; copy it again from your password manager or the Mac's .env.local";
  if (/tenant or user not found|ENOIDENTIFIER|no tenant identifier/i.test(message)) return "the user part of DATABASE_URL is wrong; it must be postgres.<project-ref> (copy DATABASE_URL from .env.example and fill in the password)";
  if (/EHOSTUNREACH|ENETUNREACH/i.test(message)) return "this network cannot reach that address (the direct database host needs IPv6); use the session pooler address from .env.example";
  if (/ENOTFOUND|EAI_AGAIN/i.test(message)) return "the host name could not be found; check DATABASE_URL and your internet connection";
  if (/ETIMEDOUT|timeout|CONNECT_TIMEOUT/i.test(message)) return "the connection timed out; check your internet connection, VPN or firewall";
  if (/ECONNREFUSED/i.test(message)) return "the connection was refused; check the port in DATABASE_URL (the session pooler uses 5432)";
  return "check DATABASE_URL against .env.example";
}

if (dbUrl) {
  const { default: postgres } = await import("postgres");
  const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 15 });
  try {
    await sql`select 1`;
    ok("database reachable");

    const tables = await sql`
      select c.relname as name, c.relrowsecurity as rls
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' order by c.relname`;

    let expected = null;
    try {
      expected = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")).entries.length;
    } catch {
      warn("could not read drizzle/meta/_journal.json to compare migrations");
    }
    let applied = 0;
    try {
      [{ n: applied }] = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
    } catch {
      applied = 0;
    }
    if (expected !== null) {
      (applied === expected ? ok : (m) => bad(m, "run: pnpm db:migrate"))(
        `migrations applied: ${applied} of ${expected}`,
      );
    }

    if (tables.length === 0) bad("no tables found in the public schema", "run: pnpm db:migrate");
    for (const t of tables) (t.rls ? ok : (m) => bad(m, "enable row-level security on this table (see CLAUDE.md)"))(`row-level security ${t.rls ? "on" : "OFF"}: ${t.name}`);
  } catch (err) {
    bad(`database connection failed: ${scrub(err.message)}`, dbHint(String(err.message)));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// ---- 5. Storage -------------------------------------------------------------------------------
function storageProblem(message) {
  const m = scrub(message);
  if (/invalid api key|jwt|jws|apikey|unauthorized|signature/i.test(m)) {
    return [`storage rejected the key: ${m}`, 'SUPABASE_SECRET_KEY is wrong; copy the "default" secret key from the Supabase dashboard (Project Settings > API Keys)'];
  }
  if (/not found/i.test(m)) return ['the "attachments" bucket does not exist', "run: pnpm storage:setup"];
  if (/ENOTFOUND|invalid url|fetch failed/i.test(m)) {
    return [`storage unreachable: ${m}`, "check SUPABASE_URL (it should look like https://<project-ref>.supabase.co) and your internet connection"];
  }
  return [`storage check failed: ${m}`, "check SUPABASE_URL and SUPABASE_SECRET_KEY"];
}

try {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.storage.getBucket("attachments");
  if (error) {
    bad(...storageProblem(error.message));
  } else {
    ok('storage reachable, bucket "attachments" exists');
    (data.public === false ? ok : (m) => bad(m, "run: pnpm storage:setup (it makes the bucket private)"))(
      `bucket "attachments" is ${data.public ? "PUBLIC" : "private"}`,
    );
  }
} catch (err) {
  bad(...storageProblem(err.message));
}

console.log(
  `\n${failed === 0 ? "All checks passed." : `${failed} problem${failed === 1 ? "" : "s"} found.`}${warned ? ` ${warned} warning${warned === 1 ? "" : "s"}.` : ""}`,
);
process.exit(failed === 0 ? 0 : 1);
