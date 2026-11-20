import { describe, expect, it } from "vitest";
import { demoRows } from "./data";

describe("demo sample data", () => {
  const today = "2026-11-19";
  const rows = demoRows(today);

  it("is the same every time", () => {
    expect(demoRows(today)).toEqual(rows);
  });

  it("has unique ids", () => {
    const ids = Object.values(rows).flatMap((list) => list.map((r: { id?: string }) => r.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps bills consistent with the readings", () => {
    for (const b of rows.electricityBills) {
      expect(Number(b.currentReading) - Number(b.previousReading)).toBeCloseTo(Number(b.units), 2);
      expect(b.dueDate! >= b.billDate).toBe(true);
    }
  });

  it("has the annex past the low slab and the main house under it", () => {
    const sinceBill = rows.electricityMeters.map((m) => {
      const lastBill = rows.electricityBills.filter((b) => b.meterId === m.id).at(-1)!;
      const newest = rows.electricityReadings.filter((r) => r.meterId === m.id).at(-1)!;
      return Number(newest.value) - Number(lastBill.currentReading);
    });
    expect(sinceBill[0]).toBeLessThan(120);
    expect(sinceBill[1]).toBeGreaterThan(125);
    expect(sinceBill[1]).toBeLessThan(170);
  });

  it("uses made-up plates and account numbers only", () => {
    expect(rows.vehicles.every((v) => /^(DEM|DM)-/.test(v.registrationNumber ?? ""))).toBe(true);
    expect(rows.electricityMeters.every((m) => m.accountNumber?.startsWith("DEMO-"))).toBe(true);
  });
});
