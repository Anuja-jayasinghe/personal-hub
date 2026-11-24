import { describe, expect, it } from "vitest";
import { accessFromGrants } from "@/features/people/access";
import { addChoices, hasAddChoice } from "./add-menu";

const grants = (...g: [string, string][]) => accessFromGrants(g.map(([area, level]) => ({ area, level })));

describe("addChoices (the one Add button, V.1a)", () => {
  it("offers all four to an owner", () => {
    expect(addChoices({ owner: true })).toEqual({ paper: true, service: true, reading: true, note: true });
  });

  it("offers a service and a reading with Add in Vehicles, and nothing else without the other sections", () => {
    const c = addChoices(grants(["vehicles", "add"]));
    expect(c).toEqual({ paper: false, service: true, reading: true, note: false });
    expect(hasAddChoice(c)).toBe(true);
  });

  it("offers a paper only with Add in Vehicle documents", () => {
    expect(addChoices(grants(["vehicles", "see"], ["vehicle_documents", "add"])).paper).toBe(true);
    expect(addChoices(grants(["vehicles", "edit"], ["vehicle_documents", "see"])).paper).toBe(false);
    expect(addChoices(grants(["vehicles", "edit"])).paper).toBe(false);
  });

  it("offers a note only with Add in Tasks & notes, plus seeing the vehicle (what adding a note needs today)", () => {
    expect(addChoices(grants(["vehicles", "see"], ["tasks_notes", "add"])).note).toBe(true);
    expect(addChoices(grants(["vehicles", "see"], ["tasks_notes", "see"])).note).toBe(false);
    expect(addChoices(grants(["tasks_notes", "edit"])).note).toBe(false);
  });

  it("mixes: a person who may add a paper and a note but not a service sees just those two", () => {
    const c = addChoices(grants(["vehicles", "see"], ["vehicle_documents", "edit"], ["tasks_notes", "add"]));
    expect(c).toEqual({ paper: true, service: false, reading: false, note: true });
  });

  it("shows no Add button at all for someone who may only look (the shared-person design)", () => {
    const c = addChoices(grants(["vehicles", "see"], ["vehicle_documents", "see"], ["tasks_notes", "see"]));
    expect(c).toEqual({ paper: false, service: false, reading: false, note: false });
    expect(hasAddChoice(c)).toBe(false);
    expect(hasAddChoice(addChoices(grants(["vehicles", "see"])))).toBe(false);
  });
});
