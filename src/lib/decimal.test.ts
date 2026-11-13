import { describe, expect, it } from "vitest";
import { fromCents, toCents } from "./decimal";

describe("toCents / fromCents", () => {
  it("round-trips decimals exactly", () => {
    for (const s of ["0.00", "0.07", "12500.50", "100.00", "9999999.99"]) {
      expect(fromCents(toCents(s))).toBe(s);
    }
  });

  it("accepts short forms", () => {
    expect(toCents("12500")).toBe(1250000);
    expect(toCents("12500.5")).toBe(1250050);
  });

  it("keeps the sign of negative amounts", () => {
    expect(fromCents(-1250)).toBe("-12.50");
    expect(fromCents(-7)).toBe("-0.07");
  });
});
