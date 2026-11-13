import { describe, expect, it } from "vitest";
import { yearSpend } from "./spend";

const TZ = "Asia/Colombo";

describe("yearSpend", () => {
  it("adds this year's services and fixes completed this year, in exact cents", () => {
    const r = yearSpend({
      services: [
        { serviceDate: "2026-03-01", cost: "4500.10" },
        { serviceDate: "2026-09-01", cost: "0.20" },
        { serviceDate: "2025-12-31", cost: "999" }, // last year
        { serviceDate: "2026-05-01", cost: null }, // no cost
      ],
      fixes: [
        { completedAt: new Date("2026-06-01T05:00:00Z"), actualCost: "12000" },
        { completedAt: new Date("2025-06-01T05:00:00Z"), actualCost: "777" }, // last year
        { completedAt: null, actualCost: "555" }, // not finished: not counted
        { completedAt: new Date("2026-07-01T05:00:00Z"), actualCost: null },
      ],
      year: 2026,
      timeZone: TZ,
    });
    expect(r).toEqual({ servicesCents: 450030, fixesCents: 1200000, totalCents: 1650030 });
  });

  it("dates a fix by the owner's calendar, not UTC", () => {
    // 20:00 UTC on 31 Dec 2026 is 1 Jan 2027 in Colombo, so it belongs to 2027.
    const fix = [{ completedAt: new Date("2026-12-31T20:00:00Z"), actualCost: "100" }];
    expect(yearSpend({ services: [], fixes: fix, year: 2026, timeZone: TZ }).fixesCents).toBe(0);
    expect(yearSpend({ services: [], fixes: fix, year: 2027, timeZone: TZ }).fixesCents).toBe(10000);
  });

  it("is zero with no data", () => {
    expect(yearSpend({ services: [], fixes: [], year: 2026, timeZone: TZ })).toEqual({ servicesCents: 0, fixesCents: 0, totalCents: 0 });
  });
});
