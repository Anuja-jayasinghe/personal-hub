import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The demo (S.9, C118) must never show real data: pages read through `readDb()` (src/db/read.ts),
 * which hands demo visitors the in-memory sample database. Only code that first checks the person
 * itself may import the real client from "@/db": Server Actions (they start with `requireUser`),
 * the auth check, owner-only downloads, file housekeeping used by actions, and the daily notification
 * run (its route checks the cron secret and production first).
 */
const ALLOWED = [
  /actions\.ts$/,
  /^src\/lib\/auth\.ts$/,
  /^src\/db\//,
  /^src\/features\/settings\/exports\.ts$/,
  /^src\/features\/shared\/(cleanup|files)\.ts$/,
  /^src\/features\/vehicles\/doc-naming\.ts$/, // names uploads inside actions, after their check (issue #179)
  /^src\/features\/notifications\/run\.ts$/, // no signed-in person; only /api/notify calls it, after CRON_SECRET and production (C139)
];

/** The real client's module ("@/db" = src/db/index.ts), as `importsOf` names it. */
const REAL_DB = "src/db";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("real database access", () => {
  it("only code that checks the person first imports the real client", () => {
    // Through the same resolver as below, so `'@/db'`, `"../../db"`, `"@/db/index"` and `import("@/db")` count too.
    const offenders = files("src")
      .map((f) => f.split(path.sep).join("/"))
      .filter((f) => importsOf(f, readFileSync(f, "utf8")).includes(REAL_DB))
      .filter((f) => !ALLOWED.some((re) => re.test(f)));
    expect(offenders).toEqual([]);
  });

  it("the real-client scan sees every way of importing @/db, and not @/db/read or @/db/schema", () => {
    const file = "src/features/x/queries.ts";
    expect(importsOf(file, 'import { db } from "@/db";')).toContain(REAL_DB);
    expect(importsOf(file, "import { db } from '@/db';")).toContain(REAL_DB);
    expect(importsOf(file, 'import { db } from "../../db";')).toContain(REAL_DB);
    expect(importsOf(file, 'import { db } from "../../db/index";')).toContain(REAL_DB);
    expect(importsOf(file, 'const { db } = await import("@/db");')).toContain(REAL_DB);
    expect(importsOf(file, 'import { readDb } from "@/db/read";')).not.toContain(REAL_DB);
    expect(importsOf(file, 'import { notifications } from "@/db/schema";')).not.toContain(REAL_DB);
  });

  it("only the cron route reaches the notification run, which reads the real database with nobody signed in", () => {
    const run = "src/features/notifications/run";
    const callers = files("src")
      .map((f) => f.split(path.sep).join("/"))
      .filter((f) => importsOf(f, readFileSync(f, "utf8")).includes(run));
    expect(callers).toEqual(["src/app/api/notify/route.ts"]);
  });

  it("the import scan sees aliased, relative, side-effect and dynamic imports", () => {
    const file = "src/features/notifications/other.ts";
    const run = "src/features/notifications/run";
    expect(importsOf(file, 'import { runNotifications } from "@/features/notifications/run";')).toContain(run);
    expect(importsOf(file, "import { runNotifications } from './run.ts';")).toContain(run);
    expect(importsOf("src/app/x/route.ts", 'const m = await import("../../features/notifications/run");')).toContain(run);
    expect(importsOf(file, 'import "./run";')).toContain(run);
    expect(importsOf(file, 'export { runNotifications } from "./run";')).toContain(run);
    expect(importsOf(file, 'import { x } from "./runner";')).not.toContain(run);
  });
});

/** Every module a file imports (static, side-effect, re-export or dynamic), as a path under src without extension. */
function importsOf(file: string, source: string): string[] {
  const specs = [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
  return specs.map((spec) => {
    const resolved = spec.startsWith("@/") ? `src/${spec.slice(2)}` : spec.startsWith(".") ? path.posix.join(path.posix.dirname(file), spec) : spec;
    return resolved.replace(/\.(ts|tsx|js|mjs)$/, "").replace(/\/index$/, "");
  });
}
