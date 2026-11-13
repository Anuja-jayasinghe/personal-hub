import { describe, expect, it } from "vitest";
import { parseService } from "./service-validate";

const ok = (raw: Record<string, string>) => {
  const r = parseService(raw);
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`);
  return r.value;
};
const err = (raw: Record<string, string>) => {
  const r = parseService(raw);
  if (r.ok) throw new Error("expected an error");
  return r.error;
};
const base = { serviceDate: "2026-11-01", serviceType: "Oil change" };

describe("parseService", () => {
  it("accepts a minimal record (date and type)", () => {
    expect(ok(base)).toEqual({ serviceDate: "2026-11-01", serviceType: "Oil change", garage: null, odometerKm: null, cost: null, itemsDone: null, nextDueDate: null });
  });

  it("accepts and tidies a full record", () => {
    expect(
      ok({ ...base, serviceType: "  Full   service ", garage: " Lanka  Motors ", odometerKm: "45,200", cost: "12,500.5", itemsDone: "  Oil\nFilter  ", nextDueDate: "2027-05-01" }),
    ).toEqual({
      serviceDate: "2026-11-01",
      serviceType: "Full service",
      garage: "Lanka Motors",
      odometerKm: 45200,
      cost: "12500.5",
      itemsDone: "Oil\nFilter",
      nextDueDate: "2027-05-01",
    });
  });

  it("requires a valid service date and a type", () => {
    expect(err({ serviceType: "Oil change" })).toMatch(/Service date is required/);
    expect(err({ ...base, serviceDate: "2026-02-31" })).toMatch(/valid date/);
    expect(err({ ...base, serviceDate: "01/11/2026" })).toMatch(/valid date/);
    expect(err({ serviceDate: "2026-11-01", serviceType: "  " })).toMatch(/Service type is required/);
  });

  it("limits lengths", () => {
    expect(err({ ...base, serviceType: "x".repeat(61) })).toMatch(/at most 60/);
    expect(err({ ...base, garage: "x".repeat(101) })).toMatch(/at most 100/);
    expect(err({ ...base, itemsDone: "x".repeat(5001) })).toMatch(/at most 5000/);
  });

  it("checks cost and odometer", () => {
    expect(ok({ ...base, cost: "0" }).cost).toBe("0");
    expect(ok({ ...base, cost: "1250.50" }).cost).toBe("1250.50");
    expect(err({ ...base, cost: "-5" })).toMatch(/Cost must be a number/);
    expect(err({ ...base, cost: "12.345" })).toMatch(/Cost must be a number/);
    expect(err({ ...base, cost: "abc" })).toMatch(/Cost must be a number/);
    expect(err({ ...base, odometerKm: "12.5" })).toMatch(/Odometer must be a whole number/);
    expect(err({ ...base, odometerKm: "10000000" })).toMatch(/at most 9999999/);
  });

  it("next due date must be real and not before the service date", () => {
    expect(ok({ ...base, nextDueDate: "2026-11-01" }).nextDueDate).toBe("2026-11-01"); // same day is fine
    expect(err({ ...base, nextDueDate: "2026-10-31" })).toMatch(/cannot be before the service date/);
    expect(err({ ...base, nextDueDate: "2026-13-01" })).toMatch(/valid date/);
  });
});
