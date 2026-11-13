import { describe, expect, it } from "vitest";
import { parseBill } from "./bill-validate";

const ok = (raw: Record<string, string>) => {
  const r = parseBill(raw);
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`);
  return r.value;
};
const err = (raw: Record<string, string>) => {
  const r = parseBill(raw);
  if (r.ok) throw new Error("expected an error");
  return r.error;
};
const base = { billDate: "2026-11-05", previousReading: "12,000", currentReading: "12,214.5" };

describe("parseBill", () => {
  it("accepts a minimal bill and works out the units", () => {
    expect(ok(base)).toEqual({
      billDate: "2026-11-05",
      readingDate: "2026-11-05", // defaults to the bill date
      previousReading: "12000",
      currentReading: "12214.5",
      units: "214.50",
      amount: null,
      dueDate: null,
      paidDate: null,
      notes: null,
    });
  });

  it("accepts a full bill; explicit units win", () => {
    expect(ok({ ...base, readingDate: "2026-11-03", units: "215", amount: "4,850.5", dueDate: "2026-11-26", paidDate: "2026-11-20", notes: " ok " })).toMatchObject({
      readingDate: "2026-11-03",
      units: "215",
      amount: "4850.5",
      dueDate: "2026-11-26",
      paidDate: "2026-11-20",
      notes: "ok",
    });
  });

  it("requires real dates and readings", () => {
    expect(err({ previousReading: "1", currentReading: "2" })).toMatch(/Bill date is required/);
    expect(err({ ...base, billDate: "2026-02-31" })).toMatch(/valid date/);
    expect(err({ ...base, readingDate: "nope" })).toMatch(/Reading date/);
    expect(err({ ...base, previousReading: "x" })).toMatch(/Previous reading/);
    expect(err({ ...base, currentReading: "" })).toMatch(/Current reading/);
  });

  it("a lower current reading needs explicit units (replaced meter)", () => {
    expect(err({ ...base, previousReading: "1250", currentReading: "30" })).toMatch(/type the units/);
    expect(ok({ ...base, previousReading: "1250", currentReading: "30", units: "80" }).units).toBe("80");
  });

  it("checks units, amount, due and paid dates", () => {
    expect(err({ ...base, units: "abc" })).toMatch(/Units must be/);
    expect(err({ ...base, amount: "-5" })).toMatch(/Amount must be/);
    expect(err({ ...base, dueDate: "2026-11-04" })).toMatch(/cannot be before the bill date/);
    expect(ok({ ...base, dueDate: "2026-11-05" }).dueDate).toBe("2026-11-05");
    expect(err({ ...base, paidDate: "2026-13-01" })).toMatch(/Paid date/);
    expect(err({ ...base, notes: "x".repeat(501) })).toMatch(/at most 500/);
  });
});
