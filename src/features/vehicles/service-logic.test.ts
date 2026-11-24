import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "@/features/settings/rules";
import { dueServices, isOilChangeType, latestPerType, nextDueToStore, oilChangeMarker, oilChangeWords, toCents, typeKey, type ServiceRow } from "./service-logic";

describe("oilChangeMarker (V.1a, C147)", () => {
  const rules = { oilChangeMonths: 6, oilChangeTypes: ["Oil change", "Full service"] };

  it("is the service date plus the rule's months, for a type in the list", () => {
    expect(oilChangeMarker("2026-06-14", "Oil change", rules)).toBe("2026-12-14");
    expect(oilChangeMarker("2026-06-14", "Full service", rules)).toBe("2026-12-14");
    expect(oilChangeMarker("2026-06-14", "Oil change", { ...rules, oilChangeMonths: 3 })).toBe("2026-09-14");
  });

  it("clamps to the month end, leap years included", () => {
    expect(oilChangeMarker("2026-08-31", "Oil change", rules)).toBe("2027-02-28");
    expect(oilChangeMarker("2027-08-31", "Oil change", rules)).toBe("2028-02-29");
    expect(oilChangeMarker("2028-02-29", "Oil change", { ...rules, oilChangeMonths: 12 })).toBe("2029-02-28");
  });

  it("matches the type ignoring case and spacing, like typeKey", () => {
    expect(oilChangeMarker("2026-06-14", "  oil   CHANGE ", rules)).toBe("2026-12-14");
    expect(isOilChangeType("FULL SERVICE", rules)).toBe(true);
  });

  it("is null for any other type, a blank type, or a date that is not a real day", () => {
    expect(oilChangeMarker("2026-06-14", "Tyres", rules)).toBeNull();
    expect(oilChangeMarker("2026-06-14", "Oil change and filter", rules)).toBeNull();
    expect(oilChangeMarker("2026-06-14", "   ", rules)).toBeNull();
    expect(oilChangeMarker("2026-02-31", "Oil change", rules)).toBeNull();
    expect(oilChangeMarker("", "Oil change", rules)).toBeNull();
  });

  it("follows the rule: a changed list or month count changes the answer", () => {
    expect(oilChangeMarker("2026-06-14", "Tyres", { ...rules, oilChangeTypes: ["Tyres"] })).toBe("2026-12-14");
    expect(oilChangeMarker("2026-06-14", "Oil change", { ...rules, oilChangeTypes: ["Tyres"] })).toBeNull();
    expect(oilChangeMarker("2026-06-14", "Oil change", DEFAULT_RULES)).toBe("2026-12-14");
  });
});

describe("oilChangeWords", () => {
  it("says the rule's own numbers", () => {
    expect(oilChangeWords({ oilChangeMonths: 6, oilChangeKm: 2500 })).toBe("6 months after this service, or 2,500 km");
    expect(oilChangeWords({ oilChangeMonths: 1, oilChangeKm: 500 })).toBe("1 month after this service, or 500 km");
    expect(oilChangeWords({ oilChangeMonths: 24, oilChangeKm: 20000 })).toBe("24 months after this service, or 20,000 km");
  });
});

describe("nextDueToStore (what createService saves)", () => {
  const rules = { oilChangeMonths: 6, oilChangeTypes: ["Oil change", "Full service"] };
  const oil = { serviceDate: "2026-06-14", serviceType: "Oil change", nextDueDate: null };

  it("fills the marker when the type matches, the field is blank and the switch is not off", () => {
    expect(nextDueToStore(oil, true, rules)).toBe("2026-12-14");
  });

  it("keeps a date the person typed or changed", () => {
    expect(nextDueToStore({ ...oil, nextDueDate: "2026-10-01" }, true, rules)).toBe("2026-10-01");
  });

  it("saves no date at all with the switch off, even if the form sent one", () => {
    expect(nextDueToStore(oil, false, rules)).toBeNull();
    expect(nextDueToStore({ ...oil, nextDueDate: "2026-12-14" }, false, rules)).toBeNull();
  });

  it("leaves a type outside the list exactly as typed, whatever the switch says", () => {
    expect(nextDueToStore({ ...oil, serviceType: "Tyres" }, true, rules)).toBeNull();
    expect(nextDueToStore({ ...oil, serviceType: "Tyres", nextDueDate: "2027-01-05" }, true, rules)).toBe("2027-01-05");
    expect(nextDueToStore({ ...oil, serviceType: "Tyres", nextDueDate: "2027-01-05" }, false, rules)).toBe("2027-01-05");
  });
});

describe("the newest oil change replaces the older marker", () => {
  let k = 0;
  const row = (serviceDate: string, over: Partial<ServiceRow> = {}): ServiceRow => ({
    id: `o${++k}`,
    vehicleId: "v1",
    serviceDate,
    serviceType: "Oil change",
    nextDueDate: oilChangeMarker(serviceDate, "Oil change", DEFAULT_RULES),
    createdAt: new Date(2026, 0, 1, 0, 0, k),
    ...over,
  });

  it("only the newest oil change reminds, so an earlier service moves the date", () => {
    const june = row("2026-06-14"); // marker 14 Dec
    const october = row("2026-10-02"); // marker 2 Apr 2027
    expect(june.nextDueDate).toBe("2026-12-14");
    expect(dueServices([june]).map((r) => r.nextDueDate)).toEqual(["2026-12-14"]);
    expect(dueServices([june, october]).map((r) => r.nextDueDate)).toEqual(["2027-04-02"]);
    expect(dueServices([october, june]).map((r) => r.id)).toEqual([october.id]);
  });

  it("a newer oil change with the switch off silences the older marker", () => {
    const june = row("2026-06-14");
    const later = row("2026-09-01", { nextDueDate: null });
    expect(dueServices([june, later])).toEqual([]);
  });

  it("without a shared cycle given, a Full service is a different type and keeps its own marker", () => {
    const oilChange = row("2026-06-14");
    const full = row("2026-07-01", { serviceType: "Full service", nextDueDate: oilChangeMarker("2026-07-01", "Full service", DEFAULT_RULES) });
    expect(dueServices([oilChange, full]).map((r) => r.nextDueDate).sort()).toEqual(["2026-12-14", "2027-01-01"]);
  });

  describe("one oil cycle (V.1b, C148)", () => {
    const oil = DEFAULT_RULES.oilChangeTypes;
    const full = (date: string, over: Partial<ServiceRow> = {}) =>
      row(date, { serviceType: "Full service", nextDueDate: oilChangeMarker(date, "Full service", DEFAULT_RULES), ...over });

    it("a newer Full service replaces an older Oil change's marker", () => {
      const oilChange = row("2026-06-14");
      const service = full("2026-07-01");
      expect(dueServices([oilChange, service], oil).map((r) => r.id)).toEqual([service.id]);
      expect(dueServices([service, oilChange], oil).map((r) => r.nextDueDate)).toEqual(["2027-01-01"]);
    });

    it("and a newer Oil change replaces an older Full service's", () => {
      const service = full("2026-03-01");
      const oilChange = row("2026-06-14");
      expect(dueServices([service, oilChange], oil).map((r) => r.id)).toEqual([oilChange.id]);
    });

    it("a newer one of the cycle with the switch off silences the other type's older marker", () => {
      const oilChange = row("2026-06-14");
      const silent = full("2026-09-01", { nextDueDate: null });
      expect(dueServices([oilChange, silent], oil)).toEqual([]);
    });

    it("matches the cycle's types ignoring case and spacing, per vehicle", () => {
      const a = row("2026-06-14", { serviceType: " oil  CHANGE " });
      const b = full("2026-07-01");
      const other = row("2026-07-01", { vehicleId: "v2", serviceType: "FULL service" });
      expect(latestPerType([a, b, other], oil).map((r) => r.id).sort()).toEqual([b.id, other.id].sort());
    });

    it("leaves every other type with a cycle of its own", () => {
      const oilChange = row("2026-06-14");
      const tyres = row("2026-05-01", { serviceType: "Tyres", nextDueDate: "2027-05-01" });
      const tyres2 = row("2026-08-01", { serviceType: "tyres", nextDueDate: "2027-08-01" });
      const brakes = row("2026-04-01", { serviceType: "Brakes", nextDueDate: "2026-12-01" });
      const ids = latestPerType([oilChange, tyres, tyres2, brakes], oil).map((r) => r.id);
      expect(ids.sort()).toEqual([oilChange.id, tyres2.id, brakes.id].sort());
    });

    it("follows the rule's list: a type added to it joins the cycle, one removed leaves it", () => {
      const oilChange = row("2026-06-14");
      const tyres = row("2026-07-01", { serviceType: "Tyres", nextDueDate: "2027-07-01" });
      expect(latestPerType([oilChange, tyres], ["Oil change", "Tyres"]).map((r) => r.id)).toEqual([tyres.id]);
      expect(latestPerType([oilChange, tyres], ["Oil change"]).map((r) => r.id).sort()).toEqual([oilChange.id, tyres.id].sort());
    });
  });
});

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
