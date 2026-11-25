import { describe, expect, it } from "vitest";
import type { ReminderResult } from "@/features/reminders/engine";
import { areaGlances, dayLabel, dayOfYear, dayStamp, daysWords, electricityNote, greetingLine, homeBrief, needsNow, placeLabels, greetingFor, meterCheckDue, nextDays, setupSteps, whenLabel } from "./home";

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

describe("dayOfYear", () => {
  it("counts the day of the year, with leap years", () => {
    expect(dayOfYear("2026-01-01")).toEqual({ day: 1, of: 365 });
    expect(dayOfYear("2026-11-19")).toEqual({ day: 323, of: 365 });
    expect(dayOfYear("2026-12-31")).toEqual({ day: 365, of: 365 });
    expect(dayOfYear("2028-12-31")).toEqual({ day: 366, of: 366 });
    expect(dayOfYear("2028-03-01")).toEqual({ day: 61, of: 366 });
  });
});

describe("greetingLine", () => {
  it("greets by the time of day, with the first name only when there is one", () => {
    expect(greetingLine(7, "Sam")).toBe("Good morning, Sam.");
    expect(greetingLine(13, null)).toBe("Good afternoon.");
    expect(greetingLine(20, "Sam")).toBe("Good evening, Sam.");
    expect(greetingLine(2, null)).toBe("Good evening.");
  });
});

describe("daysWords", () => {
  it("says a count of days the way a person would", () => {
    expect(daysWords(0)).toBe("today");
    expect(daysWords(1)).toBe("tomorrow");
    expect(daysWords(12)).toBe("in 12 days");
    expect(daysWords(-1)).toBe("yesterday");
    expect(daysWords(-3)).toBe("3 days ago");
  });
});

describe("needsNow", () => {
  const today = "2026-11-18";
  const rows = (reminders: ReturnType<typeof rem>[], checks: { meterName: string; dueDate: string }[] = []) => needsNow({ reminders, checks, checkEveryDays: 5, today });

  it("keeps what is late or due within a week, the most urgent first, and leaves later dates out", () => {
    const out = rows([rem("far", "/bills", 20), rem("soon", "/bills", 5), rem("late", "/vehicles/1", -3), rem("today", "/tasks", 0), rem("edge", "/tasks", 8), rem("week", "/tasks", 7)]);
    expect(out.map((r) => r.key)).toEqual(["late", "today", "soon", "week"]);
  });

  it("counts a meter read only once it is due or late, never ahead of its date", () => {
    const out = rows(
      [],
      [
        { meterName: "A", dueDate: "2026-11-20" },
        { meterName: "B", dueDate: "2026-11-18" },
        { meterName: "C", dueDate: "2026-11-16" },
      ],
    );
    expect(out.map((r) => [r.key, r.tone])).toEqual([
      ["check:C", "overdue"],
      ["check:B", "check"],
    ]);
  });

  it("is empty when nothing needs the person", () => {
    expect(rows([rem("far", "/bills", 12)])).toEqual([]);
  });
});

describe("areaGlances", () => {
  const withOwner = (id: string, href: string, d: number, ownerId: string): ReminderResult => ({ ...rem(id, href, d), item: { ...rem(id, href, d).item, ownerId } });

  it("gives each area its count, its late count, its soonest item and how many records are involved", () => {
    const g = areaGlances(
      [withOwner("r1", "/vehicles/1?item=renewal:r1", 10, "v1"), withOwner("r2", "/vehicles/2", -1, "v2"), withOwner("r3", "/vehicles/2", 12, "v2"), rem("b", "/bills", 40), rem("t", "/tasks", 0)],
      30,
    );
    expect(g.map((x) => [x.area, x.due, x.overdue, x.records])).toEqual([
      ["vehicles", 3, 1, 2],
      ["bills", 0, 0, 0],
      ["tasks", 1, 0, 1],
    ]);
    expect(g[0].soonest).toMatchObject({ title: "r2", daysUntil: -1, href: "/vehicles/2" });
    expect(g[1].soonest).toBeNull();
  });
});

describe("electricityNote", () => {
  const nameOf = (id: string) => (id === "a" ? "Annex" : "Main house");
  it("names the meter over its limit first, then one near it, or says nothing", () => {
    expect(
      electricityNote(
        [
          { id: "a", state: "near", left: 800, limit: 18000 },
          { id: "m", state: "over", left: -300, limit: 12000 },
        ],
        nameOf,
      ),
    ).toEqual({ tone: "overdue", text: "Main house is 3 over 120" });
    // the slab maths keeps hundredths of a unit: 800 left to 18000 is "8 units from 180" (the real-data bug of 2026-11-25
    // said "800 units from 18000")
    expect(electricityNote([{ id: "a", state: "near", left: 800, limit: 18000 }], nameOf)).toEqual({ tone: "soon", text: "Annex is 8 units from 180" });
    expect(electricityNote([{ id: "a", state: "near", left: 899, limit: 12000 }], nameOf)).toEqual({ tone: "soon", text: "Annex is 8 units from 120" }); // rounds down
    expect(electricityNote([{ id: "m", state: "over", left: -301, limit: 12000 }], nameOf)).toEqual({ tone: "overdue", text: "Main house is 4 over 120" }); // rounds up
    expect(electricityNote([{ id: "a", state: "ok", left: 5000, limit: 18000 }], nameOf)).toBeNull();
  });
});

describe("homeBrief", () => {
  const need = (key: string, daysUntil: number, tone: "overdue" | "due" | "check" = "due") => ({ key, label: key, href: "/", tone, daysUntil, date: "2026-11-18", sub: "" });
  const base = { ahead: [], electricity: null, windowDays: 30 };

  it("is a calm all clear, with what comes next, when nothing needs the person", () => {
    const b = homeBrief({
      ...base,
      needs: [],
      ahead: [
        { label: "Emission test", daysUntil: 20 },
        { label: "Revenue license", daysUntil: 12 },
      ],
    });
    expect(b).toMatchObject({ tone: "ok", headline: "All clear.", chips: [], nextUp: "Next up: Revenue license, in 12 days." });
    expect(homeBrief({ ...base, needs: [] }).nextUp).toBe("Nothing is due in the next 30 days.");
  });

  it("counts late, due this week, meter reads and the slab rule, and takes the worst tone", () => {
    const b = homeBrief({
      ...base,
      needs: [need("a", -2), need("b", 3), need("c", 6), need("Read A", 0, "check")],
      electricity: { tone: "soon", text: "Annex is 800 units from 18000" },
    });
    expect(b.headline).toBe("5 things need you.");
    expect(b.tone).toBe("overdue");
    expect(b.chips.map((c) => c.text)).toEqual(["1 late", "2 items due this week", "1 meter read due", "Annex is 800 units from 18000"]);
  });

  it("is amber with nothing late, singular for one thing, and a meter over its limit alone is red", () => {
    expect(homeBrief({ ...base, needs: [need("a", 2)] })).toMatchObject({ tone: "soon", headline: "1 thing needs you." });
    expect(homeBrief({ ...base, needs: [], electricity: { tone: "overdue", text: "Annex is 10 over 18000" } }).tone).toBe("overdue");
  });

  it("welcomes the owner who is still on the first-day steps", () => {
    expect(homeBrief({ ...base, needs: [], settingUp: true }).headline).toBe("Welcome to your hub.");
  });
});
