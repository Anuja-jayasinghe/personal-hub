import { describe, expect, it } from "vitest";
import { computeLimits, type MeterInput } from "./limits";
import { adviceLine, leftHeadline, paceLine, roleChip, unitsLeft, usedOfLimit, roomText } from "./limits-text";

const RULES = { low: 12000, high: 18000, near: 1000 };
const U = { low: 120, high: 180 };
const m = (id: string, units: number, daily: number | null = null, projected: number | null = null): MeterInput => ({
  id,
  used: units * 100,
  dailyAverage: daily === null ? null : daily * 100,
  projected: projected === null ? null : projected * 100,
});
const name = (id: string) => (id === "a" ? "Meter A" : "Meter B");

describe("roleChip / usedOfLimit / leftHeadline", () => {
  it("names the job each role has", () => {
    expect(roleChip("open", U)).toBe("Under 120");
    expect(roleChip("high", U)).toBe("Allowed to 180");
    expect(roleChip("low", U)).toBe("Hold under 120");
  });
  it("shows used against the current limit", () => {
    expect(usedOfLimit({ used: 2400, limit: 12000 })).toBe("24 of 120 used");
  });
  it("rounds units left down and the overrun up", () => {
    expect(unitsLeft({ left: 9650 })).toBe(96);
    expect(unitsLeft({ left: -150 })).toBe(-2);
    expect(leftHeadline({ left: 9600 })).toEqual({ value: 96, label: "left" });
    expect(leftHeadline({ left: -500 })).toEqual({ value: 5, label: "over" });
  });
});

describe("paceLine", () => {
  it("is null with no pace", () => {
    expect(paceLine(computeLimits([m("a", 24), m("b", 87)], RULES))).toBeNull();
  });
  it("says the cycle fits when the pace stays inside the room", () => {
    const r = computeLimits([m("a", 24, 2.18, 65), m("b", 87, 7.25, 217.5)], RULES);
    expect(paceLine(r)).toEqual({ tone: "ok", text: "On pace for about 283 units this cycle. That fits in the 300 you have." });
  });
  it("warns when the pace outruns the room and says when it runs out", () => {
    const r = computeLimits([m("a", 123, 6, 180), m("b", 62, 6, 180)], RULES);
    const line = paceLine(r)!;
    expect(line.tone).toBe("warn");
    expect(line.text).toContain("more than the 300 you have");
    expect(line.text).toMatch(/runs out in about \d+ days?\./);
  });
});

describe("roomText", () => {
  it("says the room left, or how far over, or the job while not counting", () => {
    expect(roomText({ known: true, left: 3300, limit: 12000, role: "low" }, U)).toBe("33 to 120");
    expect(roomText({ known: true, left: -550, limit: 12000, role: "low" }, U)).toBe("6 over 120");
    expect(roomText({ known: false, left: 12000, limit: 12000, role: "open" }, U)).toBe("Under 120");
  });
});

describe("adviceLine", () => {
  it("is null when there is no advice", () => {
    const r = computeLimits([m("a", 24), m("b", 87)], RULES);
    expect(adviceLine(r.advice, r, name, U)).toBeNull();
  });
  it("tells you what the other meter has left and your two choices", () => {
    const r = computeLimits([m("a", 110), m("b", 50)], RULES);
    expect(adviceLine(r.advice, r, name, U)).toBe(
      "Meter A is 10 units from 120. Meter B has 70 left. Switch to Meter B, or let Meter A pass 120 and keep Meter B under 120.",
    );
  });
  it("does not say switch when the house is already on the other meter (issue #69)", () => {
    const r = computeLimits([m("a", 110), m("b", 50)], RULES);
    expect(adviceLine(r.advice, r, name, U, "b")).toBe("Meter A is 10 units from 120. The house is already on Meter B, which has 70 left.");
    expect(adviceLine(r.advice, r, name, U, "a")).toContain("Switch to Meter B");
  });
  it("says only how close the 180 meter is, and what the other has left", () => {
    const r = computeLimits([m("a", 172), m("b", 40)], RULES);
    expect(adviceLine(r.advice, r, name, U)).toBe("Meter A is 8 units from 180. Meter B has 80 left.");
  });
  it("says a meter is over its limit, and that only one should pass 120", () => {
    const r = computeLimits([m("a", 130), m("b", 125)], RULES);
    expect(adviceLine(r.advice, r, name, U)).toBe("Meter B is over its limit: 125 of 120. Only one meter should pass 120.");
    const r2 = computeLimits([m("a", 185), m("b", 20)], RULES);
    expect(adviceLine(r2.advice, r2, name, U)).toBe("Meter A is over its limit: 185 of 180.");
  });
  it("uses singular for one unit and says 'at' when nothing is left", () => {
    const one = computeLimits([m("a", 119), m("b", 50)], RULES);
    expect(adviceLine(one.advice, one, name, U)).toContain("Meter A is 1 unit from 120.");
    const zero = computeLimits([m("a", 120), m("b", 50)], RULES);
    expect(adviceLine(zero.advice, zero, name, U)).toContain("Meter A is at 120.");
  });
});
