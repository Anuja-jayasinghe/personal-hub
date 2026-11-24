import { describe, expect, it } from "vitest";
import { addDays, addMonthsToDate, dayMonth, dayMonthIn, daysBetween, hourIn, isValidDate, todayIn, yearOfInstant } from "./dates";

describe("addMonthsToDate", () => {
  it("adds whole months and keeps the day of the month", () => {
    expect(addMonthsToDate("2026-06-14", 6)).toBe("2026-12-14");
    expect(addMonthsToDate("2026-11-30", 1)).toBe("2026-12-30");
    expect(addMonthsToDate("2026-01-01", 24)).toBe("2028-01-01");
  });

  it("clamps to the end of a shorter month", () => {
    expect(addMonthsToDate("2026-08-31", 6)).toBe("2027-02-28");
    expect(addMonthsToDate("2026-03-31", 1)).toBe("2026-04-30");
    expect(addMonthsToDate("2026-12-31", 2)).toBe("2027-02-28");
  });

  it("gets leap years right", () => {
    expect(addMonthsToDate("2027-08-31", 6)).toBe("2028-02-29"); // 2028 is a leap year
    expect(addMonthsToDate("2028-02-29", 12)).toBe("2029-02-28");
    expect(addMonthsToDate("2028-02-29", 48)).toBe("2032-02-29");
    expect(addMonthsToDate("2099-08-31", 6)).toBe("2100-02-28"); // 2100 is not a leap year
  });

  it("goes back for a negative count and crosses the year", () => {
    expect(addMonthsToDate("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonthsToDate("2026-01-15", -2)).toBe("2025-11-15");
  });

  it("refuses something that is not a real day", () => {
    expect(() => addMonthsToDate("2026-02-31", 1)).toThrow();
    expect(() => addMonthsToDate("nonsense", 1)).toThrow();
  });
});

describe("dayMonth", () => {
  it("writes a day as day and short month", () => {
    expect(dayMonth("2026-12-23")).toBe("23 Dec");
    expect(dayMonth("2027-01-01")).toBe("1 Jan");
    expect(dayMonth("2028-02-29")).toBe("29 Feb");
  });
});

describe("dayMonthIn", () => {
  it("leaves the year out in the current year", () => {
    expect(dayMonthIn("2026-12-23", "2026-11-24")).toBe("23 Dec");
    expect(dayMonthIn("2026-01-01", "2026-12-31")).toBe("1 Jan");
  });
  it("adds the year for any other year, before or after", () => {
    expect(dayMonthIn("2027-01-06", "2026-11-24")).toBe("6 Jan 2027");
    expect(dayMonthIn("2025-10-22", "2026-11-24")).toBe("22 Oct 2025");
  });
  it("turns over with the new year", () => {
    expect(dayMonthIn("2027-01-06", "2026-12-31")).toBe("6 Jan 2027");
    expect(dayMonthIn("2027-01-06", "2027-01-01")).toBe("6 Jan");
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
