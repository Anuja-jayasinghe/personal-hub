import { describe, expect, it } from "vitest";
import type { ReminderResult } from "@/features/reminders/engine";
import { dayLabel, dayStamp, dueByArea, placeLabels, greetingFor, meterCheckDue, nextDays, setupSteps, whenLabel } from "./home";

const rem = (id: string, href: string, daysUntil: number): ReminderResult => ({
  item: { id, title: id, dueDate: "2026-12-01", href, kind: "x" },
  daysUntil,
  level: daysUntil < 0 ? "overdue" : daysUntil === 0 ? "today" : daysUntil <= 7 ? "soon" : "upcoming",
  threshold: null,
});

describe("greetingFor", () => {
  it("splits the day into morning, afternoon and evening", () => {
    expect(greetingFor(7)).toBe("Morning");
    expect(greetingFor(12)).toBe("Afternoon");
    expect(greetingFor(18)).toBe("Evening");
    expect(greetingFor(2)).toBe("Evening");
  });
});

describe("meterCheckDue", () => {
  it("adds the interval to the last reading, or is today without one", () => {
    expect(meterCheckDue("2026-11-15", 5, "2026-11-18")).toBe("2026-11-20");
    expect(meterCheckDue(null, 5, "2026-11-18")).toBe("2026-11-18");
  });
});

describe("nextDays", () => {
  const today = "2026-11-18";

  it("groups reminders and meter reads by day, overdue at today, and drops what is past the window", () => {
    const days = nextDays({
      today,
      days: 30,
      checks: [
        { meterName: "Meter A", dueDate: "2026-11-20" },
        { meterName: "Meter B", dueDate: "2026-11-16" },
      ],
      reminders: [rem("bill-a", "/electricity", 16), rem("bill-b", "/electricity", 16), rem("task", "/tasks", -3), rem("far", "/bills", 45)],
    });
    expect(days.map((d) => d.day)).toEqual([0, 2, 16]);
    expect(days[0].items.map((i) => [i.label, i.tone])).toEqual([
      ["Read Meter B", "overdue"],
      ["task", "overdue"],
    ]);
    expect(days[1]).toMatchObject({ date: "2026-11-20", items: [{ label: "Read Meter A", tone: "check" }] });
    expect(days[2].items).toHaveLength(2);
  });

  it("is empty when nothing is coming", () => {
    expect(nextDays({ today, days: 30, checks: [], reminders: [] })).toEqual([]);
  });
});

describe("dueByArea", () => {
  it("counts reminders per area by where they link, within the window", () => {
    const counts = dueByArea([rem("r1", "/vehicles/1?tab=renewals", 10), rem("r2", "/vehicles/2", -1), rem("b", "/bills", 40), rem("t", "/tasks", 0)], 30);
    expect(counts).toEqual([
      { area: "vehicles", due: 2, overdue: 1 },
      { area: "bills", due: 0, overdue: 0 },
      { area: "tasks", due: 1, overdue: 0 },
    ]);
  });
});

describe("setupSteps", () => {
  it("marks each step done once its records exist", () => {
    expect(setupSteps({ meters: 0, bills: 0, readingsSinceBill: 0 }).map((s) => s.done)).toEqual([false, false, false]);
    expect(setupSteps({ meters: 2, bills: 1, readingsSinceBill: 0 }).map((s) => s.done)).toEqual([true, true, false]);
  });
});

describe("whenLabel", () => {
  it("says late, today, a weekday within the week, then a date", () => {
    expect(whenLabel(-3, "2026-11-15")).toBe("3 DAYS LATE");
    expect(whenLabel(-1, "2026-11-17")).toBe("1 DAY LATE");
    expect(whenLabel(0, "2026-11-18")).toBe("TODAY");
    expect(whenLabel(2, "2026-11-20")).toBe("FRI 20");
    expect(whenLabel(16, "2026-12-04")).toBe("4 DEC");
  });
});

describe("dayStamp", () => {
  it("is the weekday, day and month", () => {
    expect(dayStamp("2026-11-18")).toBe("WED 18 NOV");
  });
});

const item = (label: string, tone: "overdue" | "due" | "check") => ({ key: label, label, href: "/", tone, daysUntil: 0 });

describe("dayLabel", () => {
  it("says late first, then reads, dues, or both", () => {
    expect(dayLabel([item("x", "overdue"), item("Read Meter B", "overdue")])).toBe("2 LATE");
    expect(dayLabel([item("Read Meter A", "check"), item("Read Meter B", "check")])).toBe("READ A·B");
    expect(dayLabel([item("bill", "due"), item("bill 2", "due")])).toBe("2 DUE");
    expect(dayLabel([item("bill", "due"), item("Read Meter A", "check")])).toBe("1 DUE +1");
  });
});

describe("placeLabels", () => {
  const day = (d: number, ...items: ReturnType<typeof item>[]) => ({ day: d, date: "2026-11-18", items });

  it("alternates lanes for close days and drops a label when both lanes are taken", () => {
    const placed = placeLabels([day(0, item("t", "overdue")), day(2, item("Read Meter A", "check")), day(3, item("Read Meter B", "check")), day(16, item("b", "due"))], 30, 320);
    expect(placed.map((p) => p.lane)).toEqual(["up", "down", null, "up"]);
    expect(placed[2].text).toBeNull();
  });
});
