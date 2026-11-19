import { describe, expect, it } from "vitest";
import { occurrenceDays, toPay, toPayNow } from "./line";
import type { Occurrence } from "./upcoming";

const occ = (key: string, date: string, amount: number | null, overdue = false, itemId: string | null = null): Occurrence => ({
  key,
  date,
  title: key,
  kind: "bill",
  amount,
  autopay: false,
  overdue,
  itemId,
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

describe("toPayNow", () => {
  it("counts late dates and only each item's next date within a month", () => {
    const now = toPayNow(
      [
        occ("water-oct", "2026-11-05", 100, true, "water"),
        occ("water-dec", "2026-12-05", 100, false, "water"),
        occ("water-jan", "2027-01-05", 100, false, "water"),
        occ("insurance", "2027-03-01", 900, false, "ins"),
        occ("elec", "2026-11-30", 400),
      ],
      "2026-11-19",
    );
    expect(now.map((o) => o.key)).toEqual(["water-oct", "elec", "water-dec"]);
  });
});
