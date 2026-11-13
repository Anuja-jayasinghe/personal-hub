import { describe, expect, it } from "vitest";
import { applyPayment, dueAfterUndo, lastRecorded, sortPayments } from "./payments";
import { parsePayment } from "./validate";

describe("applyPayment", () => {
  it("settles the due date and moves it forward by the frequency", () => {
    expect(applyPayment({ frequency: "monthly", nextDueDate: "2026-11-30", anchorDay: 30 })).toEqual({ ok: true, settles: "2026-11-30", nextDueDate: "2026-12-30" });
    expect(applyPayment({ frequency: "weekly", nextDueDate: "2026-11-13", anchorDay: 13 })).toEqual({ ok: true, settles: "2026-11-13", nextDueDate: "2026-11-20" });
    expect(applyPayment({ frequency: "yearly", nextDueDate: "2027-02-14", anchorDay: 14 })).toEqual({ ok: true, settles: "2027-02-14", nextDueDate: "2028-02-14" });
  });

  it("keeps the anchor day through a short month", () => {
    expect(applyPayment({ frequency: "monthly", nextDueDate: "2026-01-31", anchorDay: 31 })).toMatchObject({ nextDueDate: "2026-02-28" });
    expect(applyPayment({ frequency: "monthly", nextDueDate: "2026-02-28", anchorDay: 31 })).toMatchObject({ nextDueDate: "2026-03-31" });
  });

  it("falls back to the day of the due date without an anchor", () => {
    expect(applyPayment({ frequency: "monthly", nextDueDate: "2026-11-15", anchorDay: null })).toMatchObject({ nextDueDate: "2026-12-15" });
  });

  it("finishes a one-off item", () => {
    expect(applyPayment({ frequency: "one_off", nextDueDate: "2026-11-30", anchorDay: 30 })).toEqual({ ok: true, settles: "2026-11-30", nextDueDate: null });
  });

  it("refuses an item that is already done", () => {
    const r = applyPayment({ frequency: "one_off", nextDueDate: null, anchorDay: null });
    expect(r.ok).toBe(false);
  });
});

const p = (id: string, paidDate: string, minute: number) => ({ id, paidDate, createdAt: new Date(2026, 10, 13, 10, minute) });

describe("sortPayments / lastRecorded", () => {
  const list = [p("a", "2026-09-30", 1), p("b", "2026-11-02", 2), p("c", "2026-10-30", 3)];
  it("sorts newest paid first", () => {
    expect(sortPayments(list).map((x) => x.id)).toEqual(["b", "c", "a"]);
  });
  it("breaks ties by the order recorded", () => {
    expect(sortPayments([p("x", "2026-11-02", 1), p("y", "2026-11-02", 2)]).map((x) => x.id)).toEqual(["y", "x"]);
  });
  it("finds the most recently recorded, whatever its paid date", () => {
    expect(lastRecorded(list)?.id).toBe("c");
    expect(lastRecorded([])).toBeUndefined();
  });
});

describe("dueAfterUndo", () => {
  const list = [p("a", "2026-09-30", 1), p("b", "2026-10-30", 2)];
  it("restores the settled date when the newest payment is deleted", () => {
    expect(dueAfterUndo(list, "b", "2026-10-30", "2026-11-30")).toBe("2026-10-30");
  });
  it("restores a finished one-off item", () => {
    expect(dueAfterUndo([p("a", "2026-09-30", 1)], "a", "2026-09-30", null)).toBe("2026-09-30");
  });
  it("leaves the schedule alone when an older payment is deleted", () => {
    expect(dueAfterUndo(list, "a", "2026-09-30", "2026-11-30")).toBeNull();
  });
  it("leaves the schedule alone if the due date was moved to the settled date or earlier by hand", () => {
    expect(dueAfterUndo(list, "b", "2026-10-30", "2026-10-30")).toBeNull();
    expect(dueAfterUndo(list, "b", "2026-10-30", "2026-10-15")).toBeNull();
  });
});

describe("parsePayment", () => {
  it("accepts a date alone", () => {
    expect(parsePayment({ paidDate: "2026-11-13" })).toEqual({ ok: true, value: { paidDate: "2026-11-13", amount: null, note: null } });
  });
  it("accepts an amount and a note", () => {
    expect(parsePayment({ paidDate: "2026-11-13", amount: "1,250.50", note: " paid at the counter " })).toEqual({
      ok: true,
      value: { paidDate: "2026-11-13", amount: "1250.50", note: "paid at the counter" },
    });
  });
  it("refuses bad input", () => {
    expect(parsePayment({ paidDate: "" })).toMatchObject({ ok: false });
    expect(parsePayment({ paidDate: "2026-02-31" })).toMatchObject({ ok: false });
    expect(parsePayment({ paidDate: "2026-11-13", amount: "-1" })).toMatchObject({ ok: false });
    expect(parsePayment({ paidDate: "2026-11-13", amount: "1.234" })).toMatchObject({ ok: false });
    expect(parsePayment({ paidDate: "2026-11-13", note: "x".repeat(501) })).toMatchObject({ ok: false });
    expect(parsePayment({ paidDate: "2026-11-13", note: "card 4111 1111 1111 1111" })).toMatchObject({ ok: false });
  });
});
