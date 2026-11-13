import { describe, expect, it } from "vitest";
import { addMonthsKeepingDay, anchorDayOf, daysInMonth, isFrequency, nextDueAfter, rollForward } from "./schedule";

describe("daysInMonth / anchorDayOf", () => {
  it("knows month lengths and leap years", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 11)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
  });
  it("reads the day of the month", () => {
    expect(anchorDayOf("2026-11-05")).toBe(5);
    expect(anchorDayOf("2026-01-31")).toBe(31);
  });
});

describe("addMonthsKeepingDay", () => {
  it("clamps to the last day of a shorter month and comes back to the anchor day", () => {
    expect(addMonthsKeepingDay("2026-01-31", 1, 31)).toBe("2026-02-28");
    expect(addMonthsKeepingDay("2026-02-28", 1, 31)).toBe("2026-03-31");
    expect(addMonthsKeepingDay("2026-03-31", 1, 31)).toBe("2026-04-30");
    expect(addMonthsKeepingDay("2028-01-31", 1, 31)).toBe("2028-02-29");
  });
  it("crosses year ends", () => {
    expect(addMonthsKeepingDay("2026-12-15", 1, 15)).toBe("2027-01-15");
    expect(addMonthsKeepingDay("2026-11-15", 3, 15)).toBe("2027-02-15");
    expect(addMonthsKeepingDay("2026-11-15", 12, 15)).toBe("2027-11-15");
  });
});

describe("nextDueAfter", () => {
  it("weekly adds seven days, across month and year ends", () => {
    expect(nextDueAfter("weekly", "2026-11-13")).toBe("2026-11-20");
    expect(nextDueAfter("weekly", "2026-12-28")).toBe("2027-01-04");
    expect(nextDueAfter("weekly", "2028-02-26")).toBe("2028-03-04");
  });
  it("monthly keeps the anchor day through short months", () => {
    expect(nextDueAfter("monthly", "2026-01-31")).toBe("2026-02-28");
    expect(nextDueAfter("monthly", "2026-02-28", 31)).toBe("2026-03-31");
    // without an anchor it would use the 28th: the anchor is what stops the drift
    expect(nextDueAfter("monthly", "2026-02-28")).toBe("2026-03-28");
  });
  it("quarterly adds three months", () => {
    expect(nextDueAfter("quarterly", "2026-11-30")).toBe("2027-02-28");
    expect(nextDueAfter("quarterly", "2026-02-28", 30)).toBe("2026-05-30");
  });
  it("yearly keeps a Feb 29 bill on Feb 28 in common years and back to 29", () => {
    expect(nextDueAfter("yearly", "2028-02-29")).toBe("2029-02-28");
    expect(nextDueAfter("yearly", "2029-02-28", 29)).toBe("2030-02-28");
    expect(nextDueAfter("yearly", "2031-02-28", 29)).toBe("2032-02-29");
    expect(nextDueAfter("yearly", "2026-11-13")).toBe("2027-11-13");
  });
  it("a one-off item has no next date", () => {
    expect(nextDueAfter("one_off", "2026-11-13")).toBeNull();
  });
});

describe("isFrequency", () => {
  it("accepts only the known frequencies", () => {
    expect(isFrequency("monthly")).toBe(true);
    expect(isFrequency("one_off")).toBe(true);
    expect(isFrequency("daily")).toBe(false);
    expect(isFrequency("")).toBe(false);
  });
});

describe("rollForward", () => {
  const monthly31 = { frequency: "monthly" as const, nextDueDate: "2026-01-31", anchorDay: 31 };
  it("returns a date that is today or later as it is", () => {
    expect(rollForward({ ...monthly31, nextDueDate: "2026-11-13" }, "2026-11-13")).toBe("2026-11-13");
    expect(rollForward({ ...monthly31, nextDueDate: "2026-12-01" }, "2026-11-13")).toBe("2026-12-01");
  });
  it("rolls a past monthly date forward keeping the anchor day", () => {
    expect(rollForward(monthly31, "2026-11-13")).toBe("2026-11-30");
    expect(rollForward(monthly31, "2026-03-31")).toBe("2026-03-31");
    expect(rollForward(monthly31, "2026-04-01")).toBe("2026-04-30");
  });
  it("rolls weekly and yearly items", () => {
    expect(rollForward({ frequency: "weekly", nextDueDate: "2026-10-30", anchorDay: 30 }, "2026-11-13")).toBe("2026-11-13");
    expect(rollForward({ frequency: "weekly", nextDueDate: "2026-10-30", anchorDay: 30 }, "2026-11-14")).toBe("2026-11-20");
    expect(rollForward({ frequency: "yearly", nextDueDate: "2024-02-29", anchorDay: 29 }, "2026-11-13")).toBe("2027-02-28");
  });
  it("is null for a past one-off or an item with no date", () => {
    expect(rollForward({ frequency: "one_off", nextDueDate: "2026-10-01", anchorDay: 1 }, "2026-11-13")).toBeNull();
    expect(rollForward({ frequency: "one_off", nextDueDate: "2026-12-01", anchorDay: 1 }, "2026-11-13")).toBe("2026-12-01");
    expect(rollForward({ frequency: "monthly", nextDueDate: null, anchorDay: null }, "2026-11-13")).toBeNull();
  });
});
