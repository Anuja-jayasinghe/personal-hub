import { describe, expect, it } from "vitest";
import { AREAS, isArea, isLevel } from "./access";
import { cleanGrants, summariseAccess } from "./access-summary";
import { DEFAULT_PRESET, INVITE_PRESETS, presetFor } from "./invite-presets";

describe("invite presets", () => {
  it("only use real sections and real levels, and each gives at least one section", () => {
    for (const p of INVITE_PRESETS) {
      expect(Object.keys(p.grants).length, p.id).toBeGreaterThan(0);
      for (const [area, level] of Object.entries(p.grants)) {
        expect(isArea(area), `${p.id}: ${area}`).toBe(true);
        expect(isLevel(level as string), `${p.id}: ${level}`).toBe(true);
      }
    }
    expect(new Set(INVITE_PRESETS.map((p) => p.id)).size).toBe(INVITE_PRESETS.length);
    expect(new Set(INVITE_PRESETS.map((p) => p.label)).size).toBe(INVITE_PRESETS.length);
  });

  it("are three distinct choices, from the least to the most", () => {
    expect(INVITE_PRESETS.map((p) => p.id)).toEqual(["see-only", "see-add", "no-money"]);
    expect(DEFAULT_PRESET.id).toBe("see-only");
    expect(Object.values(DEFAULT_PRESET.grants).every((l) => l === "see")).toBe(true);
  });

  it("'everything except money' has no bills and no electricity bills", () => {
    const grants = INVITE_PRESETS.find((p) => p.id === "no-money")!.grants;
    expect(grants.bills).toBeUndefined();
    expect(grants.electricity_bills).toBeUndefined();
    expect(Object.keys(grants).length).toBe(AREAS.length - 2);
  });

  it("presetFor finds a preset by its exact grants, and null for a custom choice", () => {
    for (const p of INVITE_PRESETS) expect(presetFor({ ...p.grants })?.id).toBe(p.id);
    expect(presetFor({ vehicles: "see" })).toBeNull();
    expect(presetFor({ ...DEFAULT_PRESET.grants, vehicles: "edit" })).toBeNull();
    expect(presetFor({})).toBeNull();
  });
});

describe("summariseAccess", () => {
  it("groups by the most they can do, most first, in plain words", () => {
    expect(summariseAccess({ vehicles: "add", bills: "see" })).toEqual(["See and add Vehicles", "See Bills & subscriptions"]);
    expect(summariseAccess({ vehicles: "edit", tasks_notes: "edit", bills: "add", reminders: "see", electricity_readings: "see" })).toEqual([
      "See, add and edit Vehicles and Tasks & notes",
      "See and add Bills & subscriptions",
      "See Electricity readings and Reminders",
    ]);
    expect(summariseAccess({})).toEqual([]);
  });

  it("names every section of every preset without a private word", () => {
    for (const p of INVITE_PRESETS) expect(summariseAccess(p.grants).join(" ")).toMatch(/See/);
  });
});

describe("cleanGrants", () => {
  it("keeps only real sections at real levels", () => {
    expect(cleanGrants({ vehicles: "edit", bills: "hidden", nonsense: "see", reminders: "root", tasks_notes: 3, electricity_readings: "add" })).toEqual({ vehicles: "edit", electricity_readings: "add" });
  });
});
