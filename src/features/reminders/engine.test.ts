import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { computeReminders, describeDays, groupByLevel, type ReminderItem } from "./engine";

const TODAY = "2026-11-13";
const LEADS = [30, 14, 7, 1, 0] as const;

/** An item due `offset` days from TODAY. */
function due(offset: number, extra: Partial<ReminderItem> = {}): ReminderItem {
  return {
    id: `item:${offset}`,
    title: `Due ${offset}`,
    dueDate: addDays(TODAY, offset),
    href: "/tasks",
    kind: "task",
    ...extra,
  };
}

function run(items: ReminderItem[], leads: readonly number[] = LEADS, today = TODAY) {
  return computeReminders(items, today, leads);
}

describe("computeReminders: visibility and levels", () => {
  it("hides items beyond the largest lead time and shows the boundary day", () => {
    const results = run([due(31), due(30)]);
    expect(results.map((r) => r.daysUntil)).toEqual([30]);
  });

  it("assigns levels: overdue, today, soon (1-7), upcoming (8-30)", () => {
    const byDays = Object.fromEntries(run([due(-3), due(0), due(1), due(7), due(8), due(30)]).map((r) => [r.daysUntil, r.level]));
    expect(byDays).toEqual({ "-3": "overdue", 0: "today", 1: "soon", 7: "soon", 8: "upcoming", 30: "upcoming" });
  });

  it("keeps overdue items however old they are", () => {
    const [r] = run([due(-400)]);
    expect(r.level).toBe("overdue");
    expect(r.daysUntil).toBe(-400);
  });
});

describe("computeReminders: lead-time thresholds", () => {
  const thresholdFor = (offset: number) => run([due(offset)])[0].threshold;

  it("reports the smallest lead time still at or beyond the days remaining", () => {
    expect(thresholdFor(30)).toBe(30);
    expect(thresholdFor(29)).toBe(30);
    expect(thresholdFor(15)).toBe(30);
    expect(thresholdFor(14)).toBe(14);
    expect(thresholdFor(10)).toBe(14);
    expect(thresholdFor(8)).toBe(14);
    expect(thresholdFor(7)).toBe(7);
    expect(thresholdFor(2)).toBe(7);
    expect(thresholdFor(1)).toBe(1);
    expect(thresholdFor(0)).toBe(0);
  });

  it("has no threshold once overdue", () => {
    expect(thresholdFor(-1)).toBeNull();
  });

  it("works when the lead list has no 0 entry", () => {
    const [r] = run([due(0)], [30, 7]);
    expect(r.level).toBe("today");
    expect(r.threshold).toBe(7);
  });
});

describe("computeReminders: per-item lead times", () => {
  it("lets an item warn earlier than the default", () => {
    const insurance = due(45, { leadDays: [60, 30, 14, 7, 1, 0], kind: "insurance" });
    expect(run([insurance])).toHaveLength(1);
    expect(run([insurance])[0].threshold).toBe(60);
    expect(run([due(45)])).toHaveLength(0); // default leads cap at 30
  });

  it("hides items beyond their own largest lead time", () => {
    expect(run([due(61, { leadDays: [60, 30] })])).toHaveLength(0);
    expect(run([due(60, { leadDays: [60, 30] })])).toHaveLength(1);
  });

  it("falls back to the default leads when the override is empty", () => {
    expect(run([due(30, { leadDays: [] })])).toHaveLength(1);
    expect(run([due(31, { leadDays: [] })])).toHaveLength(0);
  });
});

describe("computeReminders: calendar edges", () => {
  it("counts across a month boundary", () => {
    const [r] = run([{ ...due(0), dueDate: "2026-12-01" }], LEADS, "2026-11-30");
    expect(r.daysUntil).toBe(1);
    expect(r.level).toBe("soon");
  });

  it("counts across a year boundary", () => {
    const [r] = run([{ ...due(0), dueDate: "2027-01-02" }], LEADS, "2026-12-31");
    expect(r.daysUntil).toBe(2);
  });

  it("counts through a leap day", () => {
    const [r] = run([{ ...due(0), dueDate: "2028-03-01" }], LEADS, "2028-02-28");
    expect(r.daysUntil).toBe(2);
  });

  it("throws on a corrupt due date instead of guessing", () => {
    expect(() => run([{ ...due(0), dueDate: "2026-02-31" }])).toThrow();
  });
});

describe("computeReminders: ordering", () => {
  it("sorts most overdue first, then soonest, then by title", () => {
    const results = run([
      due(5, { id: "a", title: "B later" }),
      due(-2, { id: "b", title: "Old" }),
      due(5, { id: "c", title: "A later" }),
      due(0, { id: "d", title: "Now" }),
      due(-10, { id: "e", title: "Oldest" }),
    ]);
    expect(results.map((r) => r.item.title)).toEqual(["Oldest", "Old", "Now", "A later", "B later"]);
  });

  it("returns an empty list for no items", () => {
    expect(run([])).toEqual([]);
  });
});

describe("groupByLevel", () => {
  it("splits results into their level groups", () => {
    const groups = groupByLevel(run([due(-1), due(0), due(3), due(20)]));
    expect(groups.overdue).toHaveLength(1);
    expect(groups.today).toHaveLength(1);
    expect(groups.soon).toHaveLength(1);
    expect(groups.upcoming).toHaveLength(1);
  });
});

describe("describeDays", () => {
  it("reads naturally", () => {
    expect(describeDays(-3)).toBe("3 days overdue");
    expect(describeDays(-1)).toBe("1 day overdue");
    expect(describeDays(0)).toBe("Today");
    expect(describeDays(1)).toBe("Tomorrow");
    expect(describeDays(5)).toBe("In 5 days");
  });
});
