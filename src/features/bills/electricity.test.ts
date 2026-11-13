import { describe, expect, it } from "vitest";
import { electricityOccurrences } from "./electricity";
import { commitments, upcoming } from "./upcoming";

const TODAY = "2026-11-13";

describe("electricityOccurrences", () => {
  const bills = [
    { id: "b1", meterName: "Main", dueDate: "2026-11-10", amount: "4850.50" },
    { id: "b2", meterName: "Annex", dueDate: "2026-11-26", amount: null },
    { id: "b3", meterName: "Main", dueDate: null, amount: "100.00" }, // no due date: nothing to show
  ];

  it("turns unpaid bills with a due date into entries that link to the Electricity page", () => {
    const os = electricityOccurrences(bills, TODAY);
    expect(os).toHaveLength(2);
    expect(os[0]).toEqual({
      key: "electricity-bill:b1",
      date: "2026-11-10",
      title: "Electricity · Main",
      kind: "electricity",
      amount: 485050,
      autopay: false,
      overdue: true,
      itemId: null,
      href: "/electricity",
    });
    expect(os[1]).toMatchObject({ date: "2026-11-26", amount: null, overdue: false });
  });

  it("is empty with no bills", () => {
    expect(electricityOccurrences([], TODAY)).toEqual([]);
  });

  it("shows up in the upcoming list, in date order, and not in the monthly commitments", () => {
    const list = upcoming([], electricityOccurrences(bills, TODAY), TODAY, 60);
    expect(list.map((o) => o.title)).toEqual(["Electricity · Main", "Electricity · Annex"]);
    expect(commitments([]).total).toBe(0);
  });
});
