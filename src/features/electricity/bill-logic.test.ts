import { describe, expect, it } from "vitest";
import { billStatus, defaultUnits } from "./bill-logic";

const TODAY = "2026-11-13";

describe("billStatus", () => {
  it("a paid bill is paid, whatever its due date", () => {
    expect(billStatus({ dueDate: "2026-10-01", paidDate: "2026-10-05" }, TODAY)).toEqual({ state: "paid", paidDate: "2026-10-05" });
  });

  it("an unpaid bill past its due date is overdue", () => {
    expect(billStatus({ dueDate: "2026-11-10", paidDate: null }, TODAY)).toEqual({ state: "overdue", days: 3 });
  });

  it("an unpaid bill due today or later is due, with days remaining", () => {
    expect(billStatus({ dueDate: "2026-11-13", paidDate: null }, TODAY)).toEqual({ state: "due", days: 0 });
    expect(billStatus({ dueDate: "2026-11-20", paidDate: null }, TODAY)).toEqual({ state: "due", days: 7 });
  });

  it("an unpaid bill without a due date has none", () => {
    expect(billStatus({ dueDate: null, paidDate: null }, TODAY)).toEqual({ state: "no-due-date" });
  });
});

describe("defaultUnits", () => {
  it("is current minus previous, exactly", () => {
    expect(defaultUnits("12000.10", "12214.60")).toBe("214.50");
    expect(defaultUnits("0.1", "0.3")).toBe("0.20");
    expect(defaultUnits("100", "100")).toBe("0.00");
  });

  it("is null when the current reading is lower (replaced meter)", () => {
    expect(defaultUnits("1250", "30")).toBeNull();
  });
});
