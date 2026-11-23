import { describe, expect, it } from "vitest";
import { parseRenewal } from "./renewal-validate";

const TYPES = ["Revenue license", "Insurance", "Emission test"];
const ok = (raw: Record<string, string>, opts?: { expiryAfter?: string }) => {
  const r = parseRenewal(raw, TYPES, opts);
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`);
  return r.value;
};
const err = (raw: Record<string, string>, opts?: { expiryAfter?: string }) => {
  const r = parseRenewal(raw, TYPES, opts);
  if (r.ok) throw new Error("expected an error");
  return r.error;
};
const base = { type: "Insurance", expiryDate: "2027-03-01" };

describe("parseRenewal", () => {
  it("accepts a minimal renewal (type and expiry)", () => {
    expect(ok(base)).toEqual({ type: "Insurance", provider: null, referenceNumber: null, startDate: null, expiryDate: "2027-03-01", amount: null, odometerKm: null });
  });

  it("accepts and tidies a full renewal", () => {
    expect(
      ok({ ...base, provider: "  Ceylinco   Insurance ", referenceNumber: " POL-123 ", startDate: "2026-03-02", amount: "85,000.5" }),
    ).toEqual({ type: "Insurance", provider: "Ceylinco Insurance", referenceNumber: "POL-123", startDate: "2026-03-02", expiryDate: "2027-03-01", amount: "85000.5", odometerKm: null });
  });

  it("only allows the configured types", () => {
    expect(err({ expiryDate: "2027-03-01" })).toMatch(/type is required/);
    expect(err({ ...base, type: "Driving license" })).toMatch(/not one of the listed options/);
    expect(err({ ...base, type: "insurance" })).toMatch(/not one of the listed options/); // exact label
  });

  it("requires a real expiry date", () => {
    expect(err({ type: "Insurance" })).toMatch(/Expiry date is required/);
    expect(err({ ...base, expiryDate: "2027-02-30" })).toMatch(/valid date/);
  });

  it("start date must be real and not after expiry", () => {
    expect(ok({ ...base, startDate: "2027-03-01" }).startDate).toBe("2027-03-01"); // same day fine
    expect(err({ ...base, startDate: "2027-03-02" })).toMatch(/cannot be after the expiry/);
    expect(err({ ...base, startDate: "nope" })).toMatch(/valid date/);
  });

  it("checks amount and lengths", () => {
    expect(ok({ ...base, amount: "0" }).amount).toBe("0");
    expect(err({ ...base, amount: "-1" })).toMatch(/Amount must be a number/);
    expect(err({ ...base, amount: "1.234" })).toMatch(/Amount must be a number/);
    expect(err({ ...base, provider: "x".repeat(101) })).toMatch(/at most 100/);
    expect(err({ ...base, referenceNumber: "x".repeat(61) })).toMatch(/at most 60/);
  });

  it("a renewal must expire after the one it replaces", () => {
    expect(ok({ ...base, expiryDate: "2027-03-02" }, { expiryAfter: "2027-03-01" }).expiryDate).toBe("2027-03-02");
    expect(err({ ...base, expiryDate: "2027-03-01" }, { expiryAfter: "2027-03-01" })).toMatch(/must be after the one it replaces/);
    expect(err({ ...base, expiryDate: "2026-12-01" }, { expiryAfter: "2027-03-01" })).toMatch(/must be after/);
  });
});

describe("an emission test's odometer (issue #181)", () => {
  const test = { type: "Emission test", startDate: "2026-02-25", expiryDate: "2027-02-24" };
  const parse = (raw: Record<string, string>) => parseRenewal(raw, TYPES);

  it("keeps the test-day odometer, allowing thousands separators", () => {
    expect(parse({ ...test, odometerKm: "57,263" })).toMatchObject({ ok: true, value: { odometerKm: 57263 } });
  });

  it("needs a whole number and the test day", () => {
    expect(parse({ ...test, odometerKm: "57.5" })).toMatchObject({ ok: false });
    expect(parse({ ...test, startDate: "", odometerKm: "57263" })).toMatchObject({ ok: false, error: expect.stringMatching(/test day/) });
  });

  it("ignores an odometer on other renewal types", () => {
    expect(parse({ type: "Insurance", expiryDate: "2027-02-24", odometerKm: "1000" })).toMatchObject({ ok: true, value: { odometerKm: null } });
  });
});
