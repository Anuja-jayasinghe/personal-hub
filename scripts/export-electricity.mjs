// Electricity export (run: pnpm export:electricity [--out <folder>]).
// Writes three CSV files for spreadsheets into a new timestamped folder:
//   exports/electricity-YYYYMMDD-HHMMSS/{meters,readings,bills}.csv
// It only READS from the database, never overwrites an earlier export, and prints no secrets.
// The files hold your real data: exports/ is git-ignored, keep it that way.
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv, openClients, timestamp } from "./lib/backup-core.mjs";
import { buildElectricityCsv } from "./lib/electricity-csv.mjs";

const outIndex = process.argv.indexOf("--out");
const outRoot = resolve(outIndex > -1 ? process.argv[outIndex + 1] : "exports");

let sql;
let partDir;
try {
  loadEnv();
  ({ sql } = await openClients());

  const finalDir = resolve(outRoot, `electricity-${timestamp()}`);
  if (existsSync(finalDir)) throw new Error(`${finalDir} already exists; wait a second and try again.`);

  // Dates are cast to text so they stay plain calendar days; numerics already arrive as exact text.
  const meters = await sql`
    select name, account_number, archived_at, notes
    from electricity_meters order by lower(name)`;
  const readings = await sql`
    select m.name as meter_name, r.reading_date::text as reading_date, r.value::text as value,
           r.replaced_final_value::text as replaced_final_value, r.source, r.note
    from electricity_readings r join electricity_meters m on m.id = r.meter_id
    order by lower(m.name), r.reading_date desc, r.created_at desc`;
  const bills = await sql`
    select m.name as meter_name, b.bill_date::text as bill_date, b.reading_date::text as reading_date,
           b.previous_reading::text as previous_reading, b.current_reading::text as current_reading,
           b.units::text as units, b.amount::text as amount, b.due_date::text as due_date,
           b.paid_date::text as paid_date, b.notes
    from electricity_bills b join electricity_meters m on m.id = b.meter_id
    order by lower(m.name), b.bill_date desc, b.created_at desc`;

  // Write into a temporary folder and rename it, so a half-written export is never left looking finished.
  partDir = `${finalDir}.part`;
  mkdirSync(partDir, { recursive: true });
  const files = buildElectricityCsv({ meters, readings, bills });
  for (const [name, text] of Object.entries(files)) writeFileSync(resolve(partDir, name), text, "utf8");
  renameSync(partDir, finalDir);
  partDir = undefined;

  console.log(`Exported to ${finalDir}`);
  console.log(`  meters.csv    ${meters.length} rows`);
  console.log(`  readings.csv  ${readings.length} rows`);
  console.log(`  bills.csv     ${bills.length} rows`);
  console.log("  These files hold your real data. Keep them out of git and share them carefully.");
} catch (err) {
  console.error(`Export failed: ${err instanceof Error ? err.message : err}`);
  if (partDir) rmSync(partDir, { recursive: true, force: true });
  process.exitCode = 1;
} finally {
  await sql?.end({ timeout: 5 });
}
