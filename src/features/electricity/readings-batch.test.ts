import { describe, expect, it } from "vitest";
import { cleanKwh, parseBatch, previewReading } from "./readings-batch";

const A = { meterId: "a", name: "Meter A" };
const B = { meterId: "b", name: "Meter B" };

describe("cleanKwh", () => {
  it("accepts plain and comma-grouped numbers with up to two decimals", () => {
    expect(cleanKwh("17489")).toBe("17489");
    expect(cleanKwh(" 17,489.5 ")).toBe("17489.5");
    expect(cleanKwh("abc")).toBeNull();
    expect(cleanKwh("12.345")).toBeNull();
    expect(cleanKwh("")).toBeNull();
    expect(cleanKwh(undefined)).toBeNull();
  });
});

describe("parseBatch", () => {
  it("returns a row per filled meter and skips blank ones", () => {
    const r = parseBatch("2026-11-16", [{ ...A, raw: "17,489" }, { ...B, raw: "  " }]);
    expect(r).toEqual({ ok: true, date: "2026-11-16", rows: [{ meterId: "a", name: "Meter A", value: "17489" }] });
  });
  it("needs a valid date", () => {
    expect(parseBatch("", [{ ...A, raw: "1" }]).ok).toBe(false);
    expect(parseBatch("2026-13-40", [{ ...A, raw: "1" }]).ok).toBe(false);
    expect(parseBatch(undefined, [{ ...A, raw: "1" }]).ok).toBe(false);
  });
  it("needs at least one reading", () => {
    const r = parseBatch("2026-11-16", [{ ...A, raw: "" }, { ...B, raw: undefined }]);
    expect(r).toEqual({ ok: false, error: "Enter at least one meter's reading." });
  });
  it("names every meter whose value is not a number", () => {
    const r = parseBatch("2026-11-16", [{ ...A, raw: "x1" }, { ...B, raw: "37429" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Meter A");
  });
});

describe("previewReading", () => {
  it("says nothing for an empty field and flags junk", () => {
    expect(previewReading(1748900, "")).toEqual({ state: "empty" });
    expect(previewReading(1748900, "abc")).toEqual({ state: "invalid" });
  });
  it("flags a value below the last reading", () => {
    expect(previewReading(1748900, "17400")).toEqual({ state: "lower", last: 1748900 });
  });
  it("gives the increase since the last reading, zero included", () => {
    expect(previewReading(1748900, "17,513")).toEqual({ state: "ok", delta: 2400 });
    expect(previewReading(1748900, "17489")).toEqual({ state: "ok", delta: 0 });
  });
  it("has no increase to show when there is no earlier reading", () => {
    expect(previewReading(null, "100")).toEqual({ state: "ok", delta: null });
  });
});
