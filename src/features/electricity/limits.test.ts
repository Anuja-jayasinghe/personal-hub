import { describe, expect, it } from "vitest";
import { computeLimits, type MeterInput } from "./limits";

const RULES = { low: 12000, high: 18000, near: 1000 }; // 120 / 180 / 10 units, in hundredths
const m = (id: string, units: number | null, daily: number | null = null, projected: number | null = null): MeterInput => ({
  id,
  used: units === null ? null : units * 100,
  dailyAverage: daily === null ? null : daily * 100,
  projected: projected === null ? null : projected * 100,
});
const byId = (r: ReturnType<typeof computeLimits>, id: string) => r.meters.find((x) => x.id === id)!;

describe("computeLimits: roles", () => {
  it("leaves both meters open until one crosses 120", () => {
    const r = computeLimits([m("a", 24), m("b", 87)], RULES);
    expect(r.meters.map((x) => x.role)).toEqual(["open", "open"]);
    expect(byId(r, "a").left).toBe(9600);
    expect(byId(r, "b").left).toBe(3300);
  });

  it("makes the first meter past 120 the 180 meter and holds the other to 120", () => {
    const r = computeLimits([m("a", 123), m("b", 62)], RULES);
    expect(byId(r, "a")).toMatchObject({ role: "high", limit: 18000, left: 5700, state: "ok" });
    expect(byId(r, "b")).toMatchObject({ role: "low", limit: 12000, left: 5800, state: "ok" });
  });

  it("works the same whichever meter crosses first", () => {
    const r = computeLimits([m("a", 62), m("b", 123)], RULES);
    expect(byId(r, "b").role).toBe("high");
    expect(byId(r, "a").role).toBe("low");
  });

  it("treats exactly 120 as still within the low limit", () => {
    const r = computeLimits([m("a", 120), m("b", 30)], RULES);
    expect(r.meters.every((x) => x.role === "open")).toBe(true);
    expect(byId(r, "a")).toMatchObject({ left: 0, state: "near" });
  });
});

describe("computeLimits: states", () => {
  it("is near within 10 units of the limit and over past it", () => {
    expect(byId(computeLimits([m("a", 110), m("b", 20)], RULES), "a").state).toBe("near");
    expect(byId(computeLimits([m("a", 100), m("b", 20)], RULES), "a").state).toBe("ok");
    expect(byId(computeLimits([m("a", 185), m("b", 20)], RULES), "a")).toMatchObject({ role: "high", left: -500, state: "over" });
  });

  it("flags the second meter past 120 as a breach and keeps the most-used as the 180 meter", () => {
    const r = computeLimits([m("a", 130), m("b", 125)], RULES);
    expect(byId(r, "a").role).toBe("high");
    expect(byId(r, "b")).toMatchObject({ role: "low", state: "over", left: -500 });
    expect(r.advice).toEqual({ kind: "over", meterId: "b" });
  });

  it("counts an unknown meter as zero and says so", () => {
    const r = computeLimits([m("a", null), m("b", 50)], RULES);
    expect(byId(r, "a")).toMatchObject({ used: 0, known: false });
  });
});

describe("computeLimits: headroom", () => {
  it("is 300 minus what both used while nobody has crossed 120 (your real figures)", () => {
    const r = computeLimits([m("a", 24), m("b", 87)], RULES);
    expect(r.totalUsed).toBe(11100);
    expect(r.headroom).toBe(18900);
  });

  it("is the room each meter still has once one is the 180 meter", () => {
    expect(computeLimits([m("a", 123), m("b", 62)], RULES).headroom).toBe(11500);
  });

  it("never goes negative and ignores units already past a limit", () => {
    const r = computeLimits([m("a", 190), m("b", 130)], RULES);
    expect(r.headroom).toBe(0);
  });

  it("is zero for no meters", () => {
    expect(computeLimits([], RULES)).toMatchObject({ meters: [], totalUsed: 0, headroom: 0, pace: null, advice: null });
  });
});

describe("computeLimits: pace", () => {
  it("has no pace until some meter has one", () => {
    expect(computeLimits([m("a", 24), m("b", 87)], RULES).pace).toBeNull();
  });

  it("adds the meters' paces, projects the cycle and checks it against the headroom", () => {
    const r = computeLimits([m("a", 24, 2.18, 65), m("b", 87, 7.25, 217.5)], RULES);
    expect(r.pace!.daily).toBeCloseTo(943, 0);
    expect(r.pace!.projectedTotal).toBe(28250);
    expect(r.pace!.fits).toBe(true); // 282.5 - 111 = 171.5 more, headroom is 189
    expect(r.pace!.daysUntilOut).toBeCloseTo(18900 / 943, 1);
  });

  it("says the cycle does not fit when the pace outruns the headroom", () => {
    const r = computeLimits([m("a", 123, 6, 180), m("b", 62, 6, 180)], RULES);
    expect(r.pace!.fits).toBe(false);
  });

  it("has no run-out time when nothing is being used", () => {
    expect(computeLimits([m("a", 10, 0, 10), m("b", 10, 0, 10)], RULES).pace!.daysUntilOut).toBeNull();
  });
});

describe("computeLimits: advice", () => {
  it("says nothing while every meter is comfortable", () => {
    expect(computeLimits([m("a", 24), m("b", 87)], RULES).advice).toBeNull();
  });

  it("warns when a meter nears 120 and says how much the other has left", () => {
    const r = computeLimits([m("a", 110), m("b", 50)], RULES);
    expect(r.advice).toEqual({ kind: "near", meterId: "a", otherId: "b", otherLeft: 7000 });
  });

  it("warns when the 180 meter nears 180", () => {
    const r = computeLimits([m("a", 172), m("b", 40)], RULES);
    expect(r.advice).toMatchObject({ kind: "near", meterId: "a" });
  });

  it("puts an overrun ahead of a near-limit warning", () => {
    const r = computeLimits([m("a", 185), m("b", 115)], RULES);
    expect(r.advice).toEqual({ kind: "over", meterId: "a" });
  });
});
