import { describe, expect, it } from "vitest";
import { parsePersonEmail, parsePersonName } from "./validate";

describe("parsePersonEmail", () => {
  it("lower-cases a good address and refuses a bad one", () => {
    expect(parsePersonEmail("  Father@Example.COM ")).toEqual({ ok: true, email: "father@example.com" });
    expect(parsePersonEmail("")).toMatchObject({ ok: false });
    expect(parsePersonEmail("not an email")).toMatchObject({ ok: false });
    expect(parsePersonEmail("a@b")).toMatchObject({ ok: false });
  });
});

describe("parsePersonName", () => {
  it("tidies the name and treats blank as none", () => {
    expect(parsePersonName("  Amma   Perera ")).toBe("Amma Perera");
    expect(parsePersonName("   ")).toBeNull();
  });
});
