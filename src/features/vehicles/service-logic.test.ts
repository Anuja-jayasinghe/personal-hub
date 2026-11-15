import { describe, expect, it } from "vitest";
import { dueServices, latestPerType, toCents, typeKey, type ServiceRow } from "./service-logic";

let n = 0;
function svc(over: Partial<ServiceRow> & Pick<ServiceRow, "serviceDate">): ServiceRow {
  n++;
  return {
    id: `s${n}`,
    vehicleId: "v1",
    serviceType: "Oil change",
    nextDueDate: null,
    createdAt: new Date(2026, 0, 1, 0, 0, n),
    ...over,
  };
}

describe("typeKey", () => {
  it("ignores case and extra spaces", () => {
    expect(typeKey("  Oil   Change ")).toBe(typeKey("oil change"));
  });
});

describe("latestPerType / dueServices", () => {
  it("keeps only the newest record of a type", () => {
    const old = svc({ serviceDate: "2025-05-01", nextDueDate: "2025-11-01" });
    const newer = svc({ serviceDate: "2026-05-01", nextDueDate: "2026-11-01" });
    expect(latestPerType([old, newer]).map((r) => r.id)).toEqual([newer.id]);
    expect(dueServices([newer, old]).map((r) => r.id)).toEqual([newer.id]);
  });

  it("a newer record without a next due date cancels the older reminder", () => {
    const old = svc({ serviceDate: "2025-05-01", nextDueDate: "2025-11-01" });
    const newer = svc({ serviceDate: "2026-05-01", nextDueDate: null });
    expect(dueServices([old, newer])).toEqual([]);
  });

  it("records without a next due date never remind", () => {
    expect(dueServices([svc({ serviceDate: "2026-05-01" })])).toEqual([]);
  });

  it("different types are separate cycles; case and spacing do not matter", () => {
    const oil = svc({ serviceDate: "2026-05-01", serviceType: "Oil change", nextDueDate: "2026-11-01" });
    const brakes = svc({ serviceDate: "2026-03-01", serviceType: "Brakes", nextDueDate: "2027-03-01" });
    const oilAgain = svc({ serviceDate: "2026-06-01", serviceType: "  oil  CHANGE", nextDueDate: "2026-12-01" });
    const due = dueServices([oil, brakes, oilAgain]);
    expect(due.map((r) => r.id).sort()).toEqual([brakes.id, oilAgain.id].sort());
  });

  it("different vehicles are separate", () => {
    const a = svc({ vehicleId: "v1", serviceDate: "2026-05-01", nextDueDate: "2026-11-01" });
    const b = svc({ vehicleId: "v2", serviceDate: "2025-01-01", nextDueDate: "2025-07-01" });
    expect(dueServices([a, b])).toHaveLength(2);
  });

  it("on the same day the record entered last wins", () => {
    const first = svc({ serviceDate: "2026-05-01", nextDueDate: "2026-11-01" });
    const second = svc({ serviceDate: "2026-05-01", nextDueDate: "2026-12-01" });
    expect(latestPerType([first, second])[0].id).toBe(second.id);
    expect(latestPerType([second, first])[0].id).toBe(second.id);
  });
});

describe("toCents", () => {
  it("converts decimal strings exactly", () => {
    expect(toCents("12500.50")).toBe(1250050);
    expect(toCents("12500.5")).toBe(1250050);
    expect(toCents("12500")).toBe(1250000);
    expect(toCents("0.07")).toBe(7);
  });
});
