import { describe, expect, it } from "vitest";
import { limitInputFromUsage, limitRulesFromConfig } from "./limits-input";
import type { SinceLastBill } from "./since-bill";

describe("limitRulesFromConfig", () => {
  it("turns the configured units into hundredths", () => {
    expect(limitRulesFromConfig({ lowUnits: 120, highUnits: 180, nearUnits: 10 })).toEqual({ low: 12000, high: 18000, near: 1000 });
  });
  it("reads the real configuration by default", () => {
    const r = limitRulesFromConfig();
    expect(r.low).toBeLessThan(r.high);
    expect(r.near).toBeGreaterThan(0);
  });
});

describe("limitInputFromUsage", () => {
  it("passes the figures through when there is usage since the bill", () => {
    const usage: SinceLastBill = { state: "ok", sinceDate: "2026-11-04", asOf: "2026-11-16", units: 8700, days: 12, dailyAverage: 725, projected: 21750 };
    expect(limitInputFromUsage("b", usage)).toEqual({ id: "b", used: 8700, dailyAverage: 725, projected: 21750 });
  });
  it("is unknown without a bill or without a reading since it", () => {
    const unknown = { id: "a", used: null, dailyAverage: null, projected: null };
    expect(limitInputFromUsage("a", { state: "no-bill" })).toEqual(unknown);
    expect(limitInputFromUsage("a", { state: "no-reading", sinceDate: "2026-11-04" })).toEqual(unknown);
  });
});
