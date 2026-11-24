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
    const owners = new Set([...rows.vehicles.map((v) => v.id), ...rows.vehicleRenewals.map((r) => r.id), ...rows.vehicleServices.map((r) => r.id)]);
    expect(rows.attachments.length).toBeGreaterThan(0);
    expect(rows.attachments.every((a) => /^(DEM-1234|DM-5678|DM-2468)_[a-z-]+_\d{4}-\d{2}-\d{2}(_\d+)?\.(pdf|jpg)$/.test(a.fileName))).toBe(true);
    expect(rows.attachments.every((a) => owners.has(a.ownerId))).toBe(true);
  });

  it("names a service's invoice PLATE_service_<service date>, for a service of the plate's own vehicle", () => {
    const invoices = rows.attachments.filter((a) => a.ownerType === "vehicle_service");
    expect(invoices.length).toBeGreaterThan(0);
    for (const a of invoices) {
      const service = rows.vehicleServices.find((s) => s.id === a.ownerId)!;
      const vehicle = rows.vehicles.find((v) => v.id === service.vehicleId)!;
      expect(a.fileName).toMatch(new RegExp(`^${vehicle.registrationNumber}_service_${service.serviceDate}\\.(pdf|jpg)$`));
    }
  });

  it("has one vehicle with nothing at all, for the new-vehicle checklist", () => {
    const empty = rows.vehicles.filter((v) => ![...rows.vehicleRenewals, ...rows.vehicleServices, ...rows.vehicleOdometerReadings].some((r) => r.vehicleId === v.id) && !rows.attachments.some((a) => a.ownerId === v.id));
    expect(empty.map((v) => v.nickname)).toEqual(["New runabout"]);
  });

  it("keeps one current renewal per vehicle and type, the earlier ones renewed", () => {
    const current = rows.vehicleRenewals.filter((r) => !r.renewedAt).map((r) => `${r.vehicleId}:${r.type}`);
    expect(new Set(current).size).toBe(current.length);
    expect(rows.vehicleRenewals.some((r) => r.renewedAt)).toBe(true);
  });
});
