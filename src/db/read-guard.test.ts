import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The demo (S.9, C118) must never show real data: pages read through `readDb()` (src/db/read.ts),
 * which hands demo visitors the in-memory sample database. Only code that first checks the person
 * itself may import the real client from "@/db": Server Actions (they start with `requireUser`),
 * the auth check, owner-only downloads, file housekeeping used by actions, and the keep-awake route
 * (it checks the cron secret first).
 */
const ALLOWED = [
  /actions\.ts$/,
  /^src\/lib\/auth\.ts$/,
  /^src\/db\//,
  /^src\/features\/settings\/exports\.ts$/,
  /^src\/features\/shared\/(cleanup|files)\.ts$/,
  /^src\/features\/vehicles\/doc-naming\.ts$/, // names uploads inside actions, after their check (issue #179)
  /^src\/app\/api\/keep-awake\/route\.ts$/, // checks CRON_SECRET first (C127)
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("real database access", () => {
  it("only code that checks the person first imports the real client", () => {
    const offenders = files("src")
      .map((f) => f.split(path.sep).join("/"))
      .filter((f) => /from "@\/db";/.test(readFileSync(f, "utf8")))
      .filter((f) => !ALLOWED.some((re) => re.test(f)));
    expect(offenders).toEqual([]);
  });
});
