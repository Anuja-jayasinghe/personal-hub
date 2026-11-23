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

  it("names its sample papers with the made-up plates, and they belong to demo records", () => {
    const owners = new Set([...rows.vehicles.map((v) => v.id), ...rows.vehicleRenewals.map((r) => r.id)]);
    expect(rows.attachments.length).toBeGreaterThan(0);
    expect(rows.attachments.every((a) => /^(DEM-1234|DM-5678)_[a-z-]+_\d{4}-\d{2}-\d{2}(_\d+)?\.(pdf|jpg)$/.test(a.fileName))).toBe(true);
    expect(rows.attachments.every((a) => owners.has(a.ownerId))).toBe(true);
  });

  it("keeps one current renewal per vehicle and type, the earlier ones renewed", () => {
    const current = rows.vehicleRenewals.filter((r) => !r.renewedAt).map((r) => `${r.vehicleId}:${r.type}`);
    expect(new Set(current).size).toBe(current.length);
    expect(rows.vehicleRenewals.some((r) => r.renewedAt)).toBe(true);
  });
});
