// Backup (run: pnpm backup [--out <folder>]).
// Writes ONE zip with every table in the public schema and every file in the "attachments" bucket.
//   backups/personal-hub-YYYYMMDD-HHMMSS.zip
//     manifest.json            what is inside, with row counts and SHA-256 checksums
//     data/<table>.json        all rows of the table
//     files/attachments/...    the uploaded files, with their original paths
// It only READS from Supabase, never overwrites an earlier backup, and checks the finished zip
// against its manifest before reporting success. The zip contains your real data: keep it out of
// git (backups/ is already ignored) and store a copy somewhere safe.
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { once } from "node:events";
import { unzipSync, strToU8, Zip, ZipDeflate, ZipPassThrough } from "fflate";
import {
  BUCKET,
  FORMAT_VERSION,
  countMigrations,
  downloadObject,
  exportTable,
  formatBytes,
  listObjects,
  listPublicTables,
  loadEnv,
  openClients,
  sha256,
  timestamp,
} from "./lib/backup-core.mjs";

const outIndex = process.argv.indexOf("--out");
const outDir = resolve(outIndex > -1 ? process.argv[outIndex + 1] : "backups");

let sql;
let partPath;
try {
  loadEnv();
  const clients = await openClients();
  sql = clients.sql;
  const supabase = clients.supabase;

  mkdirSync(outDir, { recursive: true });
  const finalPath = resolve(outDir, `personal-hub-${timestamp()}.zip`);
  if (existsSync(finalPath)) throw new Error(`${finalPath} already exists; wait a second and try again.`);
  partPath = `${finalPath}.part`;

  // ---- open the zip for streaming -------------------------------------------------------------
  const out = createWriteStream(partPath);
  const zip = new Zip((err, chunk, final) => {
    if (err) throw err;
    out.write(chunk);
    if (final) out.end();
  });
  const addText = (name, text) => {
    const f = new ZipDeflate(name, { level: 6 });
    zip.add(f);
    f.push(strToU8(text), true);
  };
  const addBinary = (name, buf) => {
    const f = new ZipPassThrough(name); // images and PDFs are already compressed
    zip.add(f);
    f.push(new Uint8Array(buf), true);
  };

  // ---- database -------------------------------------------------------------------------------
  const tables = {};
  const tableNames = await listPublicTables(sql);
  for (const name of tableNames) {
    const { json, rows } = await exportTable(sql, name);
    addText(`data/${name}.json`, json);
    tables[name] = { rows, bytes: Buffer.byteLength(json), sha256: sha256(json) };
    console.log(`  table ${name}: ${rows} row${rows === 1 ? "" : "s"}`);
  }

  // ---- files ----------------------------------------------------------------------------------
  const files = [];
  for (const path of await listObjects(supabase)) {
    const buf = await downloadObject(supabase, path);
    addBinary(`files/${BUCKET}/${path}`, buf);
    files.push({ path, bytes: buf.length, sha256: sha256(buf) });
  }
  console.log(`  files: ${files.length} (${formatBytes(files.reduce((n, f) => n + f.bytes, 0))})`);

  // ---- manifest (last, so it can carry every checksum) ------------------------------------------
  const manifest = {
    app: "personal-hub",
    format: FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    source: { supabaseHost: new URL(process.env.SUPABASE_URL).hostname },
    migrations: await countMigrations(sql),
    bucket: BUCKET,
    tables,
    files,
  };
  addText("manifest.json", JSON.stringify(manifest, null, 2));
  zip.end();
  await once(out, "finish");

  // ---- verify the finished zip against its manifest ---------------------------------------------
  const entries = unzipSync(readFileSync(partPath));
  let problems = 0;
  const check = (label, actual, expected) => {
    if (actual !== expected) {
      problems++;
      console.error(`  MISMATCH ${label}`);
    }
  };
  for (const [name, t] of Object.entries(tables)) {
    const entry = entries[`data/${name}.json`];
    check(`data/${name}.json`, entry ? sha256(Buffer.from(entry)) : "missing", t.sha256);
  }
  for (const f of files) {
    const entry = entries[`files/${BUCKET}/${f.path}`];
    check(`files/${BUCKET}/${f.path}`, entry ? sha256(Buffer.from(entry)) : "missing", f.sha256);
  }
  // Rows may have changed while the backup ran; say so instead of silently trusting the copy.
  for (const name of tableNames) {
    const { rows } = await exportTable(sql, name);
    if (rows !== tables[name].rows) {
      problems++;
      console.error(`  CHANGED while backing up: ${name} (${tables[name].rows} -> ${rows} rows). Run the backup again.`);
    }
  }
  if (problems > 0) throw new Error(`${problems} problem(s) found; the backup was not kept.`);

  renameSync(partPath, finalPath);
  partPath = undefined;
  const totalRows = Object.values(tables).reduce((n, t) => n + t.rows, 0);
  console.log(
    `\nBackup written and verified: ${finalPath}\n  ${tableNames.length} tables, ${totalRows} rows, ${files.length} files, ${formatBytes(statSync(finalPath).size)}\n` +
      "  This file holds your real data. Keep it out of git and copy it somewhere safe.",
  );
} catch (err) {
  console.error(`\nBackup failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  if (partPath) rmSync(partPath, { force: true }); // never leave a half-written backup behind
  await sql?.end({ timeout: 5 });
}
