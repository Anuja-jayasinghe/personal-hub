import { describe, expect, it } from "vitest";
import { countByOwner } from "./by-owner";
import { computeReminders, type ReminderItem } from "./engine";

const TODAY = "2026-11-13";
const item = (id: string, dueDate: string, ownerId?: string): ReminderItem => ({ id, title: id, dueDate, href: "/", kind: "x", ownerId });
const run = (items: ReminderItem[]) => computeReminders(items, TODAY, [30, 14, 7, 1, 0]);

describe("countByOwner", () => {
  it("counts items and overdue items per owner, ignoring items without an owner", () => {
    const counts = countByOwner(
      run([
        item("a", "2026-11-10", "v1"), // overdue
        item("b", "2026-11-20", "v1"),
        item("c", "2026-11-14", "v2"),
        item("d", "2026-11-14"), // no owner
        item("e", "2027-06-01", "v1"), // too far away: not reminded at all
      ]),
    );
    expect(counts.get("v1")).toEqual({ total: 2, overdue: 1 });
    expect(counts.get("v2")).toEqual({ total: 1, overdue: 0 });
    expect(counts.size).toBe(2);
  });

  it("returns an empty map for no results", () => {
    expect(countByOwner([]).size).toBe(0);
  });
});
