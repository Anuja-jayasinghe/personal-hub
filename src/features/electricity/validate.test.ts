import { describe, expect, it } from "vitest";
import { parseMeter, parseReading } from "./validate";

describe("parseMeter", () => {
  it("needs a name and tidies the rest", () => {
    expect(parseMeter({ name: "  Main   house " , accountNumber: " 123 456 ", notes: " ok " })).toEqual({
      ok: true,
      value: { name: "Main house", accountNumber: "123 456", notes: "ok" },
    });
    expect(parseMeter({ name: "A" })).toEqual({ ok: true, value: { name: "A", accountNumber: null, notes: null } });
    expect(parseMeter({ name: "  " }).ok).toBe(false);
  });

  it("limits lengths", () => {
    expect(parseMeter({ name: "x".repeat(61) }).ok).toBe(false);
    expect(parseMeter({ name: "A", accountNumber: "x".repeat(41) }).ok).toBe(false);
    expect(parseMeter({ name: "A", notes: "x".repeat(501) }).ok).toBe(false);
  });
});

describe("parseReading", () => {
  const base = { readingDate: "2026-11-13", value: "12,345.6" };

  it("accepts a plain reading", () => {
    expect(parseReading(base)).toEqual({ ok: true, value: { readingDate: "2026-11-13", value: "12345.6", note: null, replacedFinalValue: null } });
  });

  it("requires a real date and a numeric value", () => {
    expect(parseReading({ value: "5" }).ok).toBe(false);
    expect(parseReading({ readingDate: "2026-02-31", value: "5" }).ok).toBe(false);
    expect(parseReading({ readingDate: "2026-11-13", value: "abc" }).ok).toBe(false);
    expect(parseReading({ readingDate: "2026-11-13", value: "-5" }).ok).toBe(false);
    expect(parseReading({ readingDate: "2026-11-13", value: "1.234" }).ok).toBe(false);
  });

  it("a replaced meter needs the old meter's final reading", () => {
    expect(parseReading({ ...base, replaced: "on" }).ok).toBe(false);
    expect(parseReading({ ...base, replaced: "on", replacedFinalValue: "9,999.5" })).toEqual({
      ok: true,
      value: { readingDate: "2026-11-13", value: "12345.6", note: null, replacedFinalValue: "9999.5" },
    });
  });

  it("ignores the old-meter field when not replaced, and limits the note", () => {
    expect(parseReading({ ...base, replacedFinalValue: "100" })).toMatchObject({ ok: true, value: { replacedFinalValue: null } });
    expect(parseReading({ ...base, note: "x".repeat(501) }).ok).toBe(false);
  });
});
