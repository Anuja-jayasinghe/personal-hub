import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_PALETTE, PALETTES, PALETTE_IDS } from "./palettes";

const themeCss = readFileSync("src/theme/theme.css", "utf8");
const globalsCss = readFileSync("src/app/globals.css", "utf8");

describe("palettes", () => {
  it("has unique ids and a default that exists", () => {
    expect(new Set(PALETTE_IDS).size).toBe(PALETTES.length);
    expect(PALETTE_IDS).toContain(DEFAULT_PALETTE);
  });

  it("has a block in theme.css for every palette except the default (which is on :root)", () => {
    for (const p of PALETTES) {
      if (p.id === DEFAULT_PALETTE) continue;
      expect(themeCss, p.id).toContain(`[data-palette="${p.id}"] {`);
    }
  });

  it("defines the colours every component needs in each palette", () => {
    const required = ["--background", "--foreground", "--card", "--primary", "--primary-foreground", "--brand-2", "--muted-foreground", "--border", "--ring", "--destructive"];
    for (const p of PALETTES) {
      const start = p.id === DEFAULT_PALETTE ? themeCss.indexOf(":root {") : themeCss.indexOf(`[data-palette="${p.id}"] {`);
      const block = themeCss.slice(start, themeCss.indexOf("}", start));
      for (const name of required) expect(block, `${p.id} ${name}`).toContain(`${name}:`);
    }
  });

  it("keys the dark: variant to exactly the dark palettes", () => {
    const variant = globalsCss.split("\n").find((l) => l.startsWith("@custom-variant dark")) ?? "";
    for (const p of PALETTES) {
      expect(variant.includes(`[data-palette="${p.id}"]`), p.id).toBe(p.dark);
    }
  });

  it("gives every palette four colour swatches", () => {
    for (const p of PALETTES) expect(p.swatches).toHaveLength(4);
  });
});
