import { describe, expect, it } from "vitest";
import { occurrenceDays, toPay } from "./line";
import type { Occurrence } from "./upcoming";

const occ = (key: string, date: string, amount: number | null, overdue = false): Occurrence => ({
  key,
  date,
  title: key,
  kind: "bill",
  amount,
  autopay: false,
  overdue,
  itemId: null,
  href: "/bills",
});

describe("toPay", () => {
  it("adds the amounts and counts those without one", () => {
    expect(toPay([occ("a", "2026-12-04", 470974), occ("b", "2026-12-04", 320410), occ("c", "2026-12-10", null)])).toEqual({ cents: 791384, withoutAmount: 1 });
  });
});

describe("occurrenceDays", () => {
  it("groups by day, puts overdue at today and drops what is past the window", () => {
    const days = occurrenceDays(
      [occ("late", "2026-11-15", 100, true), occ("a", "2026-12-04", 1), occ("b", "2026-12-04", 2), occ("far", "2027-01-30", 3)],
      "2026-11-18",
      30,
    );
    expect(days.map((d) => [d.day, d.items.map((i) => i.tone)])).toEqual([
      [0, ["overdue"]],
      [16, ["due", "due"]],
    ]);
    expect(days[0].date).toBe("2026-11-18");
  });
});
