import { describe, expect, it } from "vitest";
import { cleanLeadDays, cleanOilTypes, DEFAULT_RULES, mergeRules, OIL_LIMITS, parseOilRules, parseSlabRules } from "./rules";

describe("the oil-change rule (V.1a, C147)", () => {
  it("defaults to 6 months, 2,500 km and Oil change and Full service", () => {
    expect(DEFAULT_RULES).toMatchObject({ oilChangeMonths: 6, oilChangeKm: 2500, oilChangeTypes: ["Oil change", "Full service"] });
    expect(OIL_LIMITS).toEqual({ oilChangeMonths: { min: 1, max: 24 }, oilChangeKm: { min: 500, max: 20000 } });
  });

  const good = { oilChangeMonths: "6", oilChangeKm: "2500", oilChangeTypes: "Oil change, Full service" };

  it("accepts the numbers at both ends of their ranges", () => {
    expect(parseOilRules({ ...good, oilChangeMonths: "1", oilChangeKm: "500" })).toMatchObject({ ok: true, value: { oilChangeMonths: 1, oilChangeKm: 500 } });
    expect(parseOilRules({ ...good, oilChangeMonths: "24", oilChangeKm: "20000" })).toMatchObject({ ok: true, value: { oilChangeMonths: 24, oilChangeKm: 20000 } });
  });

  it("refuses numbers outside the limits, decimals and blanks, saying what is wrong", () => {
    expect(parseOilRules({ ...good, oilChangeMonths: "0" })).toMatchObject({ ok: false, error: expect.stringMatching(/months.*1 to 24/) });
    expect(parseOilRules({ ...good, oilChangeMonths: "25" })).toMatchObject({ ok: false });
    expect(parseOilRules({ ...good, oilChangeMonths: "2.5" })).toMatchObject({ ok: false });
    expect(parseOilRules({ ...good, oilChangeKm: "499" })).toMatchObject({ ok: false, error: expect.stringMatching(/km.*500 to 20000/) });
    expect(parseOilRules({ ...good, oilChangeKm: "20001" })).toMatchObject({ ok: false });
    expect(parseOilRules({ ...good, oilChangeKm: "" })).toMatchObject({ ok: false });
    expect(parseOilRules({ ...good, oilChangeKm: null })).toMatchObject({ ok: false });
  });

  it("needs at least one service type", () => {
    expect(parseOilRules({ ...good, oilChangeTypes: " , " })).toMatchObject({ ok: false, error: expect.stringMatching(/at least one service type/) });
    expect(parseOilRules({ ...good, oilChangeTypes: undefined })).toMatchObject({ ok: false });
  });

  it("cleans the types: trimmed, spaces squeezed, no repeats ignoring case, at most ten, none too long", () => {
    expect(cleanOilTypes(["  Oil   change ", "oil change", "Full service", "", 5, "x".repeat(61)])).toEqual(["Oil change", "Full service"]);
    expect(cleanOilTypes(Array.from({ length: 15 }, (_, i) => `Type ${i}`))).toHaveLength(10);
    expect(parseOilRules({ ...good, oilChangeTypes: ["Engine oil", "Oil Change"] })).toMatchObject({ ok: true, value: { oilChangeTypes: ["Engine oil", "Oil Change"] } });
  });

  it("is saved with the other rules and read back; bad saved values fall back one by one", () => {
    expect(mergeRules({ oilChangeMonths: 4, oilChangeKm: 3000, oilChangeTypes: ["Oil change"] })).toMatchObject({ oilChangeMonths: 4, oilChangeKm: 3000, oilChangeTypes: ["Oil change"] });
    // a bad month count does not reset the km, a bad slab does not reset the oil numbers
    expect(mergeRules({ oilChangeMonths: 99, oilChangeKm: 3000 })).toMatchObject({ oilChangeMonths: 6, oilChangeKm: 3000 });
    expect(mergeRules({ lowUnits: 300, highUnits: 200, oilChangeMonths: 4 })).toMatchObject({ lowUnits: 120, oilChangeMonths: 4 });
    expect(mergeRules({ oilChangeTypes: [] }).oilChangeTypes).toEqual(["Oil change", "Full service"]);
    expect(mergeRules({}).oilChangeTypes).not.toBe(DEFAULT_RULES.oilChangeTypes);
  });
});

const good = { lowUnits: "120", highUnits: "180", nearUnits: "10", checkEveryDays: "5", billingCycleDays: "30" };

describe("parseSlabRules", () => {
  it("accepts sensible numbers", () => {
    expect(parseSlabRules(good)).toEqual({ ok: true, value: { lowUnits: 120, highUnits: 180, nearUnits: 10, checkEveryDays: 5, billingCycleDays: 30 } });
  });
  it("refuses numbers out of range, decimals, a high slab not above the low one, and a warning not below it", () => {
    expect(parseSlabRules({ ...good, lowUnits: "5" })).toMatchObject({ ok: false, error: expect.stringMatching(/low slab.*10 to 1000/) });
    expect(parseSlabRules({ ...good, checkEveryDays: "2.5" })).toMatchObject({ ok: false });
    expect(parseSlabRules({ ...good, highUnits: "120" })).toMatchObject({ ok: false, error: "The high slab must be more than the low slab." });
    expect(parseSlabRules({ ...good, nearUnits: "100", lowUnits: "100" })).toMatchObject({ ok: false, error: "The warning must be smaller than the low slab." });
    expect(parseSlabRules({ ...good, billingCycleDays: "" })).toMatchObject({ ok: false });
  });
});

describe("cleanLeadDays", () => {
  it("keeps only offered days, once each, largest first", () => {
    expect(cleanLeadDays(["7", 30, "0", 7, 5, "abc", 90])).toEqual([90, 30, 7, 0]);
  });
});

describe("mergeRules", () => {
  it("uses the defaults when nothing is saved", () => {
    expect(mergeRules(null)).toEqual(DEFAULT_RULES);
  });
  it("lays what is saved over the defaults, and ignores what is invalid", () => {
    expect(mergeRules({ lowUnits: 100, highUnits: 200, leadDays: [14, 1] })).toMatchObject({ lowUnits: 100, highUnits: 200, nearUnits: DEFAULT_RULES.nearUnits, leadDays: [14, 1] });
    expect(mergeRules({ lowUnits: 300, highUnits: 200 })).toMatchObject({ lowUnits: DEFAULT_RULES.lowUnits, highUnits: DEFAULT_RULES.highUnits });
    expect(mergeRules({ leadDays: [] }).leadDays).toEqual(DEFAULT_RULES.leadDays);
  });
});
