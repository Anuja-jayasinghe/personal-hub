import { describe, expect, it } from "vitest";
import { checklistFootnote, newVehicleChecklist } from "./checklist";
import type { DocKind } from "./doc-names";
import type { PaperCan } from "./paper-flow";

const BOTH: PaperCan = { records: true, files: true };
const RECORDS_ONLY: PaperCan = { records: true, files: false };
const FILES_ONLY: PaperCan = { records: false, files: true };
const NEITHER: PaperCan = { records: false, files: false };

const base: { can: PaperCan; renewalTypes: string[]; documentKinds: DocKind[]; askOdometer: boolean } = { can: BOTH, renewalTypes: [], documentKinds: [], askOdometer: true };

describe("the new-vehicle checklist", () => {
  it("lists the four rows in the designed order for a vehicle with nothing", () => {
    const c = newVehicleChecklist(base)!;
    expect(c.rows.map((r) => r.label)).toEqual(["Registration book", "Revenue license", "Insurance", "Emission test"]);
    expect(c).toMatchObject({ done: 0, total: 4 });
    expect(c.rows.every((r) => !r.done)).toBe(true);
  });

  it("ticks a renewal kind when a record of it exists, even an old expired or renewed one", () => {
    const c = newVehicleChecklist({ ...base, renewalTypes: ["Revenue license", "Insurance"] })!;
    expect(c.rows.map((r) => [r.kind, r.done])).toEqual([
      ["book", false],
      ["license", true],
      ["insurance", true],
      ["emission", false],
    ]);
    expect(c).toMatchObject({ done: 2, total: 4 });
  });

  it("reads renewal types the way the rest of the app does (case, extra words)", () => {
    const c = newVehicleChecklist({ ...base, renewalTypes: ["revenue licence 2024", "EMISSION TEST"] })!;
    expect(c.rows.find((r) => r.kind === "license")!.done).toBe(true);
    expect(c.rows.find((r) => r.kind === "emission")!.done).toBe(true);
  });

  it("a renewal type outside the three ticks nothing", () => {
    const c = newVehicleChecklist({ ...base, renewalTypes: ["Parking permit"] })!;
    expect(c.done).toBe(0);
  });

  it("ticks the book only from a book document, never from a renewal", () => {
    expect(newVehicleChecklist({ ...base, renewalTypes: ["Revenue license"] })!.rows[0].done).toBe(false);
    expect(newVehicleChecklist({ ...base, documentKinds: ["book"] })!.rows[0].done).toBe(true);
    expect(newVehicleChecklist({ ...base, documentKinds: ["other", "insurance"] })!.rows[0].done).toBe(false);
  });

  it("with both kinds of access, a license kept only as a document does not tick (no record, no reminders)", () => {
    const c = newVehicleChecklist({ ...base, documentKinds: ["license"] })!;
    expect(c.rows.find((r) => r.kind === "license")!.done).toBe(false);
  });

  it("disappears once every row is done: no complete state", () => {
    expect(newVehicleChecklist({ ...base, renewalTypes: ["Revenue license", "Insurance", "Emission test"], documentKinds: ["book"] })).toBeNull();
  });

  it("stays while any one row is missing", () => {
    const c = newVehicleChecklist({ ...base, renewalTypes: ["Revenue license", "Insurance", "Emission test"] })!;
    expect(c).toMatchObject({ done: 3, total: 4 });
  });

  it("a person who may only add records sees the three renewal rows and counts only those", () => {
    const c = newVehicleChecklist({ ...base, can: RECORDS_ONLY, renewalTypes: ["Insurance"] })!;
    expect(c.rows.map((r) => r.kind)).toEqual(["license", "insurance", "emission"]);
    expect(c).toMatchObject({ done: 1, total: 3 });
  });

  it("a records-only person is finished after the three renewals, whatever the book says", () => {
    expect(newVehicleChecklist({ ...base, can: RECORDS_ONLY, renewalTypes: ["Revenue license", "Insurance", "Emission test"] })).toBeNull();
  });

  it("a person who may only add files sees all four rows, and a kept file of a renewal kind ticks it", () => {
    const c = newVehicleChecklist({ ...base, can: FILES_ONLY, documentKinds: ["insurance", "book"] })!;
    expect(c.rows.map((r) => [r.kind, r.done])).toEqual([
      ["book", true],
      ["license", false],
      ["insurance", true],
      ["emission", false],
    ]);
    expect(c.total).toBe(4);
  });

  it("a files-only person's rows say they keep the file with no reminders", () => {
    const c = newVehicleChecklist({ ...base, can: FILES_ONLY })!;
    expect(c.rows.every((r) => /no reminders/.test(r.hint))).toBe(true);
  });

  it("a see-only person never gets a checklist", () => {
    expect(newVehicleChecklist({ ...base, can: NEITHER })).toBeNull();
    expect(newVehicleChecklist({ ...base, can: NEITHER, renewalTypes: ["Insurance"] })).toBeNull();
  });

  it("an archived vehicle gets none", () => {
    expect(newVehicleChecklist({ ...base, archived: true })).toBeNull();
  });

  it("the emission row mentions the odometer only for a vehicle that carries one", () => {
    const withOdo = newVehicleChecklist({ ...base, askOdometer: true })!.rows.find((r) => r.kind === "emission")!;
    const without = newVehicleChecklist({ ...base, askOdometer: false })!.rows.find((r) => r.kind === "emission")!;
    expect(withOdo.hint).toMatch(/odometer/i);
    expect(without.hint).not.toMatch(/odometer/i);
    // No other row ever mentions it.
    expect(newVehicleChecklist(base)!.rows.filter((r) => r.kind !== "emission").some((r) => /odometer/i.test(r.hint))).toBe(false);
  });
});

describe("the line under the checklist", () => {
  it("names the oil-change months from the rule in force", () => {
    expect(checklistFootnote({ service: true, reading: true }, 6)).toBe("A service or an odometer reading can come any time from Add. The first oil change sets the 6-month marker.");
    expect(checklistFootnote({ service: true, reading: true }, 4)).toContain("4-month marker");
  });

  it("only says what the person can do", () => {
    expect(checklistFootnote({ service: false, reading: true }, 6)).toBe("An odometer reading can come any time from Add.");
    expect(checklistFootnote({ service: true, reading: false }, 6)).toBe("A service can come any time from Add. The first oil change sets the 6-month marker.");
    expect(checklistFootnote({ service: false, reading: false }, 6)).toBeNull();
  });
});
