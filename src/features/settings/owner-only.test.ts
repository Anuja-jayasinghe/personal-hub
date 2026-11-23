import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Settings is the owner's only (S.8, C114). The layout checks it, but a partial page request can render
 * a page without its layout, so every Settings page puts all of its content inside <OwnerOnly> (which
 * checks the owner before any of it renders), and the notification queries (which read the real
 * database through `readDb()`) check it too.
 */
const dir = path.join("src", "app", "(app)", "settings");

function pages(d: string): string[] {
  return readdirSync(d).flatMap((name) => {
    const full = path.join(d, name);
    return statSync(full).isDirectory() ? pages(full) : name === "page.tsx" ? [full] : [];
  });
}

describe("Settings pages", () => {
  const found = pages(dir);

  it("finds them", () => {
    expect(found.length).toBeGreaterThanOrEqual(5);
  });

  for (const page of found) {
    it(`${page} renders everything inside <OwnerOnly>`, () => {
      const source = readFileSync(page, "utf8");
      const body = source.split(/export default function \w+\([^)]*\)\s*\{/)[1] ?? "";
      expect(body).toMatch(/^\s*(\/\/[^\n]*\n\s*)*return \(\n\s*<OwnerOnly>\n[^]*\n\s*<\/OwnerOnly>\n\s*\);\n\}\s*$/);
    });
  }

  it("<OwnerOnly> checks the owner before rendering its children", () => {
    const source = readFileSync(path.join("src", "components", "settings", "owner-only.tsx"), "utf8");
    expect(source).toMatch(/async function OwnerCheck[^]*?await requirePage\("owner"\);\s*return <>\{children\}<\/>;/);
  });

  it("the notification queries check the owner themselves", () => {
    const source = readFileSync(path.join("src", "features", "notifications", "queries.ts"), "utf8");
    for (const fn of ["getComingUp", "listRecentNotifications", "loadPushSetup"]) {
      const body = source.split(`export async function ${fn}(`)[1]?.split(/\n}\n/)[0] ?? "";
      expect(body, fn).toMatch(/await viewingOwner\(\)/);
      expect(body.indexOf("viewingOwner()"), fn).toBeLessThan(body.indexOf("readDb()"));
    }
    expect(source).toMatch(/async function viewingOwner\(\)[^]*?await requirePage\("owner"\)/);
    expect(source).toMatch(/export const getPushSetup = cache\(loadPushSetup\);/);
  });
});
