import { describe, expect, it } from "vitest";
import { DOC_TITLE_MAX, parseDocTitle } from "./documents";

describe("parseDocTitle", () => {
  it("requires a title and tidies spaces", () => {
    expect(parseDocTitle("  Insurance   2026-2027 ")).toEqual({ ok: true, value: "Insurance 2026-2027" });
    expect(parseDocTitle("").ok).toBe(false);
    expect(parseDocTitle("   ").ok).toBe(false);
    expect(parseDocTitle(undefined).ok).toBe(false);
  });
  it("rejects a title that is too long", () => {
    expect(parseDocTitle("a".repeat(DOC_TITLE_MAX)).ok).toBe(true);
    expect(parseDocTitle("a".repeat(DOC_TITLE_MAX + 1)).ok).toBe(false);
  });
});
