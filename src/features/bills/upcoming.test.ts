import { describe, expect, it } from "vitest";
import { byDate, commitments, lastDayOf, monthGrid, monthlyEquivalent, occurrencesOf, upcoming, type BillLike } from "./upcoming";

const TODAY = "2026-11-13";
const item = (over: Partial<BillLike> & { id: string }): BillLike => ({
  name: over.id,
  kind: "bill",
  frequency: "monthly",
  nextDueDate: "2026-11-20",
  anchorDay: 20,
  amount: null,
  autopay: false,
  ...over,
});
const dates = (os: { date: string }[]) => os.map((o) => o.date);

describe("occurrencesOf", () => {
  it("lists a recurring item's dates up to the limit", () => {
    expect(dates(occurrencesOf(item({ id: "a" }), TODAY, "2027-01-31"))).toEqual(["2026-11-20", "2026-12-20", "2027-01-20"]);
  });

  it("keeps the anchor day through short months", () => {
    const os = occurrencesOf(item({ id: "a", nextDueDate: "2026-11-30", anchorDay: 31 }), TODAY, "2027-03-31");
    expect(dates(os)).toEqual(["2026-11-30", "2026-12-31", "2027-01-31", "2027-02-28", "2027-03-31"]);
  });

  it("counts a past due date once as overdue, then carries on from today", () => {
    const os = occurrencesOf(item({ id: "a", nextDueDate: "2026-08-20", anchorDay: 20 }), TODAY, "2026-12-31");
    expect(os.map((o) => [o.date, o.overdue])).toEqual([
      ["2026-08-20", true],
      ["2026-11-20", false],
      ["2026-12-20", false],
    ]);
  });

  it("starts an autopay item at its next charge, never overdue", () => {
    const os = occurrencesOf(item({ id: "a", autopay: true, nextDueDate: "2026-08-20", anchorDay: 20 }), TODAY, "2026-12-31");
    expect(os.map((o) => [o.date, o.overdue])).toEqual([
      ["2026-11-20", false],
      ["2026-12-20", false],
    ]);
  });

  it("handles weekly items and includes the limit day", () => {
    const os = occurrencesOf(item({ id: "w", frequency: "weekly", nextDueDate: "2026-11-13", anchorDay: 13 }), TODAY, "2026-11-27");
    expect(dates(os)).toEqual(["2026-11-13", "2026-11-20", "2026-11-27"]);
  });

  it("a one-off item has one date, or none when finished", () => {
    expect(dates(occurrencesOf(item({ id: "o", frequency: "one_off", nextDueDate: "2026-12-01" }), TODAY, "2027-12-31"))).toEqual(["2026-12-01"]);
    expect(occurrencesOf(item({ id: "o", frequency: "one_off", nextDueDate: null }), TODAY, "2027-12-31")).toEqual([]);
  });

  it("is empty when nothing falls inside the limit", () => {
    expect(occurrencesOf(item({ id: "a", nextDueDate: "2027-05-01" }), TODAY, "2026-12-31")).toEqual([]);
  });
});

describe("upcoming", () => {
  it("merges items and extra entries, soonest first, within the horizon", () => {
    const extra = [
      { key: "e1", date: "2026-11-15", title: "Electricity · Main", kind: "electricity" as const, amount: null, autopay: false, overdue: false, itemId: null, href: "/electricity" },
      { key: "e2", date: "2027-06-01", title: "Far", kind: "electricity" as const, amount: null, autopay: false, overdue: false, itemId: null, href: "/electricity" },
    ];
    const list = upcoming([item({ id: "a", nextDueDate: "2026-11-20" }), item({ id: "b", nextDueDate: "2026-11-01", anchorDay: 1 })], extra, TODAY, 30);
    expect(list.map((o) => [o.title, o.date])).toEqual([
      ["b", "2026-11-01"], // overdue first
      ["Electricity · Main", "2026-11-15"],
      ["a", "2026-11-20"],
      ["b", "2026-12-01"],
    ]);
  });
});

describe("monthlyEquivalent", () => {
  it("converts each frequency to a monthly figure in hundredths", () => {
    expect(monthlyEquivalent("monthly", 100000)).toBe(100000);
    expect(monthlyEquivalent("quarterly", 300000)).toBe(100000);
    expect(monthlyEquivalent("yearly", 1200000)).toBe(100000);
    expect(monthlyEquivalent("weekly", 120000)).toBe(520000); // 52 weeks / 12 months = 4.333 weeks
    expect(monthlyEquivalent("one_off", 5000)).toBeNull();
  });
  it("rounds to whole hundredths", () => {
    expect(monthlyEquivalent("yearly", 1000)).toBe(83); // 83.33
    expect(monthlyEquivalent("quarterly", 1000)).toBe(333);
  });
});

describe("commitments", () => {
  const items = [
    item({ id: "rent", name: "Rent", amount: 5000000 }),
    item({ id: "net", name: "Netflix", kind: "subscription", amount: 149050, autopay: true }),
    item({ id: "ins", name: "Insurance", frequency: "yearly", amount: 1200000 }),
    item({ id: "water", name: "Water" }), // no usual amount
    item({ id: "fee", name: "Fee", frequency: "one_off", amount: 90000 }),
    item({ id: "done", name: "Done", frequency: "one_off", nextDueDate: null, amount: 100 }),
  ];
  it("adds up recurring items with an amount, split by kind", () => {
    const c = commitments(items);
    expect(c.bills).toBe(5000000 + 100000);
    expect(c.subscriptions).toBe(149050);
    expect(c.total).toBe(5000000 + 100000 + 149050);
    expect(c.lines.map((l) => l.name)).toEqual(["Rent", "Netflix", "Insurance"]);
  });
  it("sums the year exactly and lists items without an amount, leaving one-offs out", () => {
    const c = commitments(items);
    expect(c.perYear).toBe(5000000 * 12 + 149050 * 12 + 1200000);
    expect(c.withoutAmount).toEqual([{ id: "water", name: "Water" }]);
    expect(c.lines.some((l) => l.name === "Fee" || l.name === "Done")).toBe(false);
  });
  it("is zero with no items", () => {
    expect(commitments([])).toEqual({ total: 0, bills: 0, subscriptions: 0, perYear: 0, lines: [], withoutAmount: [] });
  });
});

describe("monthGrid / lastDayOf / byDate", () => {
  it("lays November 2026 out Monday first (it starts on a Sunday)", () => {
    const weeks = monthGrid("2026-11");
    expect(weeks[0]).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(weeks[1][0]).toBe("2026-11-02");
    expect(weeks.at(-1)).toEqual(["2026-11-30", null, null, null, null, null, null]);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
  });
  it("handles a month starting on Monday and a leap February", () => {
    expect(monthGrid("2026-06")[0][0]).toBe("2026-06-01");
    expect(monthGrid("2028-02").flat().filter(Boolean)).toHaveLength(29);
    expect(monthGrid("2026-02").flat().filter(Boolean)).toHaveLength(28);
  });
  it("finds the last day of a month", () => {
    expect(lastDayOf("2026-11")).toBe("2026-11-30");
    expect(lastDayOf("2028-02")).toBe("2028-02-29");
    expect(lastDayOf("2026-12")).toBe("2026-12-31");
  });
  it("groups occurrences by date", () => {
    const o = (date: string, k: string) => ({ key: k, date, title: k, kind: "bill" as const, amount: null, autopay: false, overdue: false, itemId: null, href: "" });
    const g = byDate([o("2026-11-20", "a"), o("2026-11-20", "b"), o("2026-11-21", "c")]);
    expect(g.get("2026-11-20")?.map((x) => x.key)).toEqual(["a", "b"]);
    expect(g.get("2026-11-21")?.length).toBe(1);
    expect(g.get("2026-11-22")).toBeUndefined();
  });
});
