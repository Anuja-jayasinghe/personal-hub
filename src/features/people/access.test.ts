import { describe, expect, it } from "vitest";
import { accessFromGrants, allows, areaOfFile, areaOfOwner, navItemVisible, sharedVisible, visibleAreas, type Access } from "./access";

const reader: Access = accessFromGrants([
  { area: "electricity_readings", level: "add" },
  { area: "bills", level: "see" },
  { area: "nonsense", level: "edit" },
  { area: "vehicles", level: "owner" },
]);

describe("allows", () => {
  it("lets owners do everything", () => {
    expect(allows({ owner: true }, "electricity_bills", "edit")).toBe(true);
  });
  it("grows from see to add to edit, and Hidden allows nothing", () => {
    expect(allows(reader, "electricity_readings", "see")).toBe(true);
    expect(allows(reader, "electricity_readings", "add")).toBe(true);
    expect(allows(reader, "electricity_readings", "edit")).toBe(false);
    expect(allows(reader, "bills", "add")).toBe(false);
    expect(allows(reader, "electricity_bills", "see")).toBe(false);
  });
  it("ignores unknown sections and levels", () => {
    expect(allows(reader, "vehicles", "see")).toBe(false);
    expect(visibleAreas(reader)).toEqual(["electricity_readings", "bills"]);
  });
});

describe("areaOfOwner", () => {
  it("puts attached tasks, notes and files in the section of their record", () => {
    expect(areaOfOwner("vehicle")).toBe("vehicles");
    expect(areaOfOwner("bill_payment")).toBe("bills");
    expect(areaOfOwner("meter")).toBe("electricity_readings");
    expect(areaOfOwner(null)).toBe("tasks_notes");
    expect(areaOfOwner("note")).toBe("tasks_notes");
  });
});

describe("areaOfFile", () => {
  it("puts a vehicle's files and a renewal's papers in Vehicle documents, and only the cover photo in Vehicles", () => {
    expect(areaOfFile("vehicle")).toBe("vehicle_documents");
    expect(areaOfFile("vehicle_renewal")).toBe("vehicle_documents");
    expect(areaOfFile("vehicle", true)).toBe("vehicles");
  });

  it("follows the record for every other file", () => {
    expect(areaOfFile("bill_payment")).toBe("bills");
    expect(areaOfFile("meter")).toBe("electricity_readings");
    expect(areaOfFile("task")).toBe("tasks_notes");
    expect(areaOfFile(null)).toBe("tasks_notes");
  });

  it("does not let Vehicles alone add or delete vehicle papers", () => {
    const vehiclesOnly = accessFromGrants([{ area: "vehicles", level: "edit" }]);
    for (const ownerType of ["vehicle", "vehicle_renewal"] as const) {
      expect(allows(vehiclesOnly, areaOfFile(ownerType), "add")).toBe(false);
      expect(allows(vehiclesOnly, areaOfFile(ownerType), "edit")).toBe(false);
    }
    expect(allows(vehiclesOnly, areaOfFile("vehicle", true), "edit")).toBe(true);
  });
});

describe("navItemVisible", () => {
  it("shows Home and More always, Settings to owners, and parts by their sections", () => {
    expect(navItemVisible(reader, "home")).toBe(true);
    expect(navItemVisible(reader, "settings")).toBe(false);
    expect(navItemVisible({ owner: true }, "settings")).toBe(true);
    expect(navItemVisible(reader, "electricity")).toBe(true);
    expect(navItemVisible(reader, "bills")).toBe(true);
    expect(navItemVisible(reader, "vehicles")).toBe(false);
    expect(navItemVisible(reader, "tasks")).toBe(false);
  });
});

describe("sharedVisible", () => {
  it("needs Tasks & notes, plus the attached record's section", () => {
    const a = accessFromGrants([{ area: "tasks_notes", level: "add" }, { area: "bills", level: "see" }]);
    expect(sharedVisible(a, null)).toBe(true);
    expect(sharedVisible(a, "bill_item")).toBe(true);
    expect(sharedVisible(a, "vehicle")).toBe(false);
    expect(sharedVisible(a, null, "edit")).toBe(false);
    expect(sharedVisible(accessFromGrants([{ area: "vehicles", level: "edit" }]), "vehicle")).toBe(false);
  });
});
