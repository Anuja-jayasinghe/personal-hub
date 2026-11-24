import { describe, expect, it } from "vitest";
import { addDays, dayMonth, daysBetween, hourIn, isValidDate, todayIn, yearOfInstant } from "./dates";

describe("dayMonth", () => {
  it("writes a day as day and short month", () => {
    expect(dayMonth("2026-12-23")).toBe("23 Dec");
    expect(dayMonth("2027-01-01")).toBe("1 Jan");
    expect(dayMonth("2028-02-29")).toBe("29 Feb");
  });
});

describe("daysBetween", () => {
  it("is 0 for the same day", () => {
    expect(daysBetween("2026-11-13", "2026-11-13")).toBe(0);
  });

  it("counts forwards and backwards", () => {
    expect(daysBetween("2026-11-13", "2026-11-20")).toBe(7);
    expect(daysBetween("2026-11-20", "2026-11-13")).toBe(-7);
  });

  it("crosses month and year boundaries", () => {
    expect(daysBetween("2026-11-30", "2026-12-01")).toBe(1);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2026-01-01", "2027-01-01")).toBe(365);
  });

  it("handles leap years", () => {
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2); // 2028 is a leap year
    expect(daysBetween("2027-02-28", "2027-03-01")).toBe(1);
    expect(daysBetween("2028-01-01", "2029-01-01")).toBe(366);
  });

  it("rejects things that are not real calendar dates", () => {
    expect(() => daysBetween("2026-02-31", "2026-03-01")).toThrow(/no such calendar day/);
    expect(() => daysBetween("2026-13-01", "2026-03-01")).toThrow();
    expect(() => daysBetween("2026-00-10", "2026-03-01")).toThrow();
    expect(() => daysBetween("13/11/2026", "2026-03-01")).toThrow(/YYYY-MM-DD/);
    expect(() => daysBetween("2026-1-1", "2026-03-01")).toThrow(/YYYY-MM-DD/);
    expect(() => daysBetween("2027-02-29", "2027-03-01")).toThrow(); // 2027 is not a leap year
  });
});

describe("addDays", () => {
  it("moves across month, year and leap day", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("is consistent with daysBetween", () => {
    for (const n of [-40, -1, 0, 1, 7, 30, 31, 400]) {
      expect(daysBetween("2026-11-13", addDays("2026-11-13", n))).toBe(n);
    }
  });
});

describe("todayIn", () => {
  it("uses the calendar day in the given time zone (Asia/Colombo is UTC+5:30)", () => {
    // 23:59:59 in Colombo is still the 12th; one second later it is the 13th.
    expect(todayIn("Asia/Colombo", new Date("2026-11-12T18:29:59Z"))).toBe("2026-11-12");
    expect(todayIn("Asia/Colombo", new Date("2026-11-12T18:30:00Z"))).toBe("2026-11-13");
  });

  it("differs from UTC around midnight", () => {
    const instant = new Date("2026-11-12T20:00:00Z");
    expect(todayIn("UTC", instant)).toBe("2026-11-12");
    expect(todayIn("Asia/Colombo", instant)).toBe("2026-11-13");
  });

  it("handles zones behind UTC", () => {
    // 07:00 UTC is 23:00 the previous day in Los Angeles (PST, UTC-8) in November.
    expect(todayIn("America/Los_Angeles", new Date("2026-11-13T07:00:00Z"))).toBe("2026-11-12");
  });

  it("returns YYYY-MM-DD", () => {
    expect(todayIn("Asia/Colombo", new Date("2026-01-05T00:00:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("isValidDate", () => {
  it("accepts real calendar days", () => {
    expect(isValidDate("2026-11-13")).toBe(true);
    expect(isValidDate("2028-02-29")).toBe(true);
  });

  it("rejects everything else", () => {
    for (const bad of ["2026-02-31", "2027-02-29", "2026-13-01", "13/11/2026", "2026-1-1", "", "not a date"]) {
      expect(isValidDate(bad)).toBe(false);
    }
  });
});

describe("yearOfInstant", () => {
  it("uses the year in the given time zone around New Year", () => {
    // 20:00 UTC on 31 Dec is already 1 Jan in Colombo (UTC+5:30), but still 2026 in UTC.
    const instant = new Date("2026-12-31T20:00:00Z");
    expect(yearOfInstant(instant, "UTC")).toBe(2026);
    expect(yearOfInstant(instant, "Asia/Colombo")).toBe(2027);
  });
});

describe("hourIn", () => {
  it("is the hour of day in the time zone, midnight as 0", () => {
    expect(hourIn("Asia/Colombo", new Date("2026-11-12T18:29:59Z"))).toBe(23);
    expect(hourIn("Asia/Colombo", new Date("2026-11-12T18:30:00Z"))).toBe(0);
    expect(hourIn("Asia/Colombo", new Date("2026-11-12T03:30:00Z"))).toBe(9);
    expect(hourIn("UTC", new Date("2026-11-12T00:00:00Z"))).toBe(0);
  });
});
