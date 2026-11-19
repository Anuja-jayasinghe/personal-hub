import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Server Actions are public HTTP endpoints, so each one must check that a signed-in, allowed
 * person is calling (Phase 4.1, DECISIONS C61) and that they may do this (S.8, C114). This test reads
 * every "use server" file and fails if an exported action does not call `requireUser(<what it needs>)`
 * before doing anything else, so a new action cannot be added without the check.
 */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

const actionFiles = files("src").filter((f) => readFileSync(f, "utf8").trimStart().startsWith('"use server"'));

describe("Server Actions", () => {
  it("finds the action files", () => {
    expect(actionFiles.length).toBeGreaterThanOrEqual(7);
  });

  for (const file of actionFiles) {
    it(`${file}: every exported action calls requireUser(<requirement>) first`, () => {
      const source = readFileSync(file, "utf8");
      const parts = source.split(/^export async function /m).slice(1);
      expect(parts.length).toBeGreaterThan(0);
      for (const part of parts) {
        const name = part.slice(0, part.indexOf("("));
        // the call must come before any database access or other work: within the first lines of the body
        const body = part.slice(part.indexOf("{") + 1).split("\n").slice(0, 4).join("\n");
        expect(body, `${file}: ${name}()`).toMatch(/await requireUser\((?:"owner"|"signed-in"|\{ area: "[a-z_]+", level: "(?:see|add|edit)" \})\);/);
      }
    });
  }
});
