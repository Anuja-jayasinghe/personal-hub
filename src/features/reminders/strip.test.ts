import { describe, expect, it } from "vitest";
import type { ReminderResult } from "./engine";
import { reminderStrip } from "./strip";

const res = (id: string, dueDate: string, daysUntil: number): ReminderResult => ({
  item: { id, title: id, dueDate, href: "/", kind: "task" },
  daysUntil,
  level: daysUntil < 0 ? "overdue" : "soon",
  threshold: null,
});

describe("reminderStrip", () => {
  it("has a cell per day from today, overdue counted on today", () => {
    const strip = reminderStrip([res("late", "2026-11-15", -3), res("today", "2026-11-18", 0), res("fri", "2026-11-20", 2), res("far", "2026-12-20", 32)], "2026-11-18");
    expect(strip).toHaveLength(21);
    expect(strip[0]).toEqual({ date: "2026-11-18", n: 18, weekday: "W", due: 2, late: 1 });
    expect(strip[2]).toMatchObject({ n: 20, weekday: "F", due: 1, late: 0 });
    expect(strip.reduce((s, d) => s + d.due, 0)).toBe(3);
  });
});
