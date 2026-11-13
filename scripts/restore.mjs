// Restore (run: pnpm backup:restore <file.zip> [--wipe] [--dry-run]).
// Puts a backup made by `pnpm backup` back: rows into the database tables and files into the
// "attachments" bucket.
//
// Safety rules:
//   * the zip is checked against its manifest (SHA-256 of every entry) before anything is touched
//   * it REFUSES to run if any table already has rows or the bucket already has files
//   * --wipe empties every table and the bucket first, and asks you to type a confirmation phrase
//     (or pass --confirm "wipe personal-hub" in a script). Use it only to replace data on purpose.
//   * --dry-run does all the checks and prints what would happen, changing nothing
// To restore into a brand-new Supabase project: create it, run `pnpm db:migrate` and
// `pnpm storage:setup` against it first, then run this.
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { resolve } from "node:path";
import { unzipSync } from "fflate";
import {
  BUCKET,
  FORMAT_VERSION,
  countMigrations,
  exportTable,
  formatBytes,
  listObjects,
  listPublicTables,
  loadEnv,
  openClients,
  quoteIdent,
  removeAllObjects,
  sha256,
} from "./lib/backup-core.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const confirmIndex = args.indexOf("--confirm");
const confirmValue = confirmIndex > -1 ? args[confirmIndex + 1] : undefined;
const zipArg = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--confirm");
const WIPE_PHRASE = "wipe personal-hub";

const fail = (msg) => {
  throw new Error(msg);
};

let sql;
try {
  if (!zipArg) fail("Usage: pnpm backup:restore <file.zip> [--wipe] [--dry-run]");
  const zipPath = resolve(zipArg);
  const wipe = flag("--wipe");
  const dryRun = flag("--dry-run");

  // ---- read and verify the zip ------------------------------------------------------------------
  let entries;
  try {
    entries = unzipSync(readFileSync(zipPath));
  } catch (err) {
    fail(`Could not read ${zipPath} as a zip file: ${err.message}`);
  }
  if (!entries["manifest.json"]) fail("This zip has no manifest.json, so it is not a backup made by pnpm backup.");
  const manifest = JSON.parse(Buffer.from(entries["manifest.json"]).toString("utf8"));
  if (manifest.app !== "personal-hub" || manifest.format !== FORMAT_VERSION) {
    fail(`Unsupported backup (app "${manifest.app}", format ${manifest.format}); this script reads format ${FORMAT_VERSION}.`);
  }

  const bad = [];
  for (const [name, t] of Object.entries(manifest.tables)) {
    const entry = entries[`data/${name}.json`];
    if (!entry || sha256(Buffer.from(entry)) !== t.sha256) bad.push(`data/${name}.json`);
  }
  for (const f of manifest.files) {
    const entry = entries[`files/${manifest.bucket}/${f.path}`];
    if (!entry || sha256(Buffer.from(entry)) !== f.sha256) bad.push(`files/${manifest.bucket}/${f.path}`);
  }
  if (bad.length > 0) fail(`The backup is damaged or incomplete. These entries do not match their checksums:\n  ${bad.join("\n  ")}`);

  const backupRows = Object.values(manifest.tables).reduce((n, t) => n + t.rows, 0);
  const backupBytes = manifest.files.reduce((n, f) => n + f.bytes, 0);
  console.log(
    `Backup from ${manifest.createdAt} (Supabase ${manifest.source.supabaseHost}): ${Object.keys(manifest.tables).length} tables, ${backupRows} rows, ${manifest.files.length} files (${formatBytes(backupBytes)}). Checksums OK.`,
  );

  // ---- look at the target -----------------------------------------------------------------------
  loadEnv();
  const clients = await openClients();
  sql = clients.sql;
  const supabase = clients.supabase;
  console.log(`Restoring into ${new URL(process.env.SUPABASE_URL).hostname}`);

  const dbTables = await listPublicTables(sql);
  const missingTables = Object.keys(manifest.tables).filter((t) => !dbTables.includes(t));
  if (missingTables.length > 0) {
    fail(`This database has no table(s): ${missingTables.join(", ")}. Run pnpm db:migrate first.`);
  }
  const applied = await countMigrations(sql);
  if (applied < manifest.migrations) {
    fail(`This database has ${applied} migrations applied but the backup was made with ${manifest.migrations}. Run pnpm db:migrate first.`);
  }

  // Columns in the backup must exist in the database (extra new columns in the database are fine).
  const columns = await sql`
    select table_name, column_name from information_schema.columns where table_schema = 'public'`;
  const columnsOf = (table) => new Set(columns.filter((c) => c.table_name === table).map((c) => c.column_name));
  const parsed = {};
  for (const name of Object.keys(manifest.tables)) {
    const text = Buffer.from(entries[`data/${name}.json`]).toString("utf8");
    const rows = JSON.parse(text);
    parsed[name] = { text, rows, columns: rows.length > 0 ? Object.keys(rows[0]) : [] };
    const unknown = parsed[name].columns.filter((c) => !columnsOf(name).has(c));
    if (unknown.length > 0) fail(`Table ${name}: the backup has column(s) this database lacks: ${unknown.join(", ")}.`);
  }

  const existing = {};
  for (const name of dbTables) existing[name] = (await exportTable(sql, name)).rows;
  const existingRows = Object.values(existing).reduce((n, r) => n + r, 0);
  const existingFiles = (await listObjects(supabase)).length;

  if ((existingRows > 0 || existingFiles > 0) && !wipe) {
    const where = Object.entries(existing).filter(([, n]) => n > 0).map(([t, n]) => `${t} (${n})`).join(", ");
    fail(
      `The target is not empty: ${existingRows} rows${where ? ` in ${where}` : ""} and ${existingFiles} files. Nothing was changed.\n` +
        "To replace what is there on purpose, run again with --wipe.",
    );
  }

  if (dryRun) {
    console.log(`Dry run: would ${wipe ? `delete ${existingRows} rows and ${existingFiles} files, then ` : ""}restore ${backupRows} rows and ${manifest.files.length} files. Nothing was changed.`);
  } else {
    // ---- confirm a wipe -------------------------------------------------------------------------
    if (wipe && (existingRows > 0 || existingFiles > 0)) {
      console.log(`\n--wipe will PERMANENTLY DELETE ${existingRows} rows and ${existingFiles} files in the target before restoring.`);
      let answer = confirmValue;
      if (answer === undefined) {
        if (!process.stdin.isTTY) fail(`--wipe needs confirmation: run it in a terminal, or pass --confirm "${WIPE_PHRASE}".`);
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        answer = await rl.question(`Type "${WIPE_PHRASE}" to continue: `);
        rl.close();
      }
      if (answer !== WIPE_PHRASE) fail("Confirmation phrase did not match. Nothing was changed.");
    }

    // ---- restore: files first (safe to repeat), then all rows in one transaction -----------------
    if (wipe) {
      const removed = await removeAllObjects(supabase);
      console.log(`  removed ${removed} existing file(s)`);
    }
    for (const f of manifest.files) {
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(f.path, Buffer.from(entries[`files/${manifest.bucket}/${f.path}`]), { upsert: true, contentType: contentTypeFor(f.path) });
      if (error) fail(`Could not upload ${f.path}: ${error.message}. Run the restore again with --wipe to start over.`);
    }
    console.log(`  uploaded ${manifest.files.length} file(s)`);

    await sql.begin(async (tx) => {
      if (wipe) for (const name of dbTables) await tx.unsafe(`delete from ${quoteIdent(name)}`);
      for (const [name, t] of Object.entries(parsed)) {
        if (t.rows.length === 0) continue;
        const cols = t.columns.map(quoteIdent).join(", ");
        await tx.unsafe(
          `insert into ${quoteIdent(name)} (${cols})
           select ${cols} from json_populate_recordset(null::${quoteIdent(name)}, $1::text::json)`,
          [t.text], // sent as text, then cast: casting the parameter straight to json would JSON-encode it twice
        );
        console.log(`  restored ${name}: ${t.rows.length} row${t.rows.length === 1 ? "" : "s"}`);
      }
    });

    // ---- verify: what is in the database now must match the backup byte for byte ---------------
    const problems = [];
    for (const [name, t] of Object.entries(manifest.tables)) {
      const { json } = await exportTable(sql, name);
      if (sha256(json) !== t.sha256) problems.push(`table ${name} differs from the backup`);
    }
    const nowFiles = new Set(await listObjects(supabase));
    for (const f of manifest.files) if (!nowFiles.has(f.path)) problems.push(`file ${f.path} is missing`);
    if (problems.length > 0) fail(`Restore finished but verification failed:\n  ${problems.join("\n  ")}`);
    console.log(`\nRestore complete and verified: ${backupRows} rows and ${manifest.files.length} files match the backup.`);
  }
} catch (err) {
  console.error(`\nRestore failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await sql?.end({ timeout: 5 });
}

function contentTypeFor(path) {
  const ext = path.split(".").pop().toLowerCase();
  return { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", heic: "image/heic" }[ext] ?? "application/octet-stream";
}
