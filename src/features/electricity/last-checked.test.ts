import { describe, expect, it } from "vitest";
import { checkNudge, checkedText, isOverdue, lastChecked } from "./last-checked";

describe("lastChecked", () => {
  it("counts the whole days since the newest reading", () => {
    expect(lastChecked("2026-11-13", "2026-11-16", 5)).toEqual({ state: "known", date: "2026-11-13", days: 3, overdue: false });
  });
  it("is overdue once it is as old as the limit", () => {
    expect(lastChecked("2026-11-11", "2026-11-16", 5)).toMatchObject({ days: 5, overdue: true });
    expect(lastChecked("2026-11-12", "2026-11-16", 5)).toMatchObject({ days: 4, overdue: false });
  });
  it("is never checked without a reading, and treats a future date as today", () => {
    expect(lastChecked(null, "2026-11-16", 5)).toEqual({ state: "never" });
    expect(lastChecked("2026-11-18", "2026-11-16", 5)).toMatchObject({ days: 0, overdue: false });
  });
});

describe("checkedText / isOverdue", () => {
  it("says it in plain words", () => {
    expect(checkedText(lastChecked("2026-11-16", "2026-11-16", 5))).toBe("Checked today");
    expect(checkedText(lastChecked("2026-11-15", "2026-11-16", 5))).toBe("Checked yesterday");
    expect(checkedText(lastChecked("2026-11-10", "2026-11-16", 5))).toBe("Checked 6 days ago");
    expect(checkedText({ state: "never" })).toBe("Never checked");
  });
  it("treats never-checked as overdue", () => {
    expect(isOverdue({ state: "never" })).toBe(true);
    expect(isOverdue(lastChecked("2026-11-16", "2026-11-16", 5))).toBe(false);
  });
});

describe("checkNudge", () => {
  const today = "2026-11-16";
  it("is null when every meter is fresh", () => {
    expect(checkNudge([{ name: "Meter A", check: lastChecked("2026-11-15", today, 5) }, { name: "Meter B", check: lastChecked("2026-11-16", today, 5) }])).toBeNull();
  });
  it("names only the meters that are overdue", () => {
    expect(
      checkNudge([{ name: "Meter A", check: lastChecked("2026-11-10", today, 5) }, { name: "Meter B", check: lastChecked("2026-11-16", today, 5) }]),
    ).toBe("Time to read the meters: Meter A was last checked 6 days ago.");
  });
  it("mentions a meter with no reading", () => {
    expect(checkNudge([{ name: "Meter A", check: { state: "never" } }, { name: "Meter B", check: lastChecked("2026-11-01", today, 5) }])).toBe(
      "Time to read the meters: Meter A has no reading yet, Meter B was last checked 15 days ago.",
    );
  });
});
