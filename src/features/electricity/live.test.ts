import { describe, expect, it } from "vitest";
import { currentLive, liveForText, switchProblem, type LiveSwitch } from "./live";

const sw = (id: string, meterId: string, switchedOn: string, at = "2026-11-01T00:00:00Z"): LiveSwitch => ({ id, meterId, switchedOn, createdAt: new Date(at) });

describe("currentLive", () => {
  it("is the newest switch to an active meter", () => {
    const list = [sw("1", "a", "2026-11-01"), sw("2", "b", "2026-11-10"), sw("3", "a", "2026-11-05")];
    expect(currentLive(list, ["a", "b"])).toEqual({ meterId: "b", since: "2026-11-10", switchId: "2" });
  });

  it("breaks a same-day tie by when the switch was entered", () => {
    const list = [sw("1", "a", "2026-11-10", "2026-11-10T08:00:00Z"), sw("2", "b", "2026-11-10", "2026-11-10T09:00:00Z")];
    expect(currentLive(list, ["a", "b"])?.meterId).toBe("b");
  });

  it("skips archived meters and is null when nothing is set", () => {
    expect(currentLive([sw("1", "a", "2026-11-01"), sw("2", "gone", "2026-11-10")], ["a", "b"])?.meterId).toBe("a");
    expect(currentLive([sw("2", "gone", "2026-11-10")], ["a", "b"])).toBeNull();
    expect(currentLive([], ["a"])).toBeNull();
  });
});

describe("switchProblem", () => {
  const base = { meterId: "b", date: "2026-11-19", today: "2026-11-19", live: { meterId: "a", since: "2026-11-10", switchId: "1" }, activeIds: ["a", "b"] };
  it("accepts a switch to the other meter today or after the last switch", () => {
    expect(switchProblem(base)).toBeNull();
    expect(switchProblem({ ...base, date: "2026-11-10" })).toBeNull();
    expect(switchProblem({ ...base, live: null, date: "2026-10-01" })).toBeNull();
  });
  it("refuses the wrong meter, a future or bad day, the same meter, or a day before the last switch", () => {
    expect(switchProblem({ ...base, meterId: "x" })).toMatch(/not one of/);
    expect(switchProblem({ ...base, date: "2026-11-20" })).toMatch(/future/);
    expect(switchProblem({ ...base, date: "2026-13-01" })).toMatch(/Pick the day/);
    expect(switchProblem({ ...base, meterId: "a" })).toMatch(/already/);
    expect(switchProblem({ ...base, date: "2026-11-09" })).toMatch(/before the last switch/);
  });
});

describe("liveForText", () => {
  it("says how long the meter has been live", () => {
    expect(liveForText("2026-11-19", "2026-11-19")).toBe("since today");
    expect(liveForText("2026-11-18", "2026-11-19")).toBe("since yesterday");
    expect(liveForText("2026-11-15", "2026-11-19")).toBe("for 4 days");
  });
});
