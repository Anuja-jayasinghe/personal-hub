import { describe, expect, it } from "vitest";
import { cleanLeadDays, DEFAULT_RULES, mergeRules, parseSlabRules } from "./rules";

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
