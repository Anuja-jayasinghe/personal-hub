import { describe, expect, it } from "vitest";
import type { ChequeStatus } from "@/db/schema/cheques";
import { CHEQUE_STATUSES } from "@/db/schema/cheques";
import { canMove, finished, inTheBank, staleDate, staleLine, viewOf, waitingFirst } from "./logic";

describe("staleDate: the cheque date plus six calendar months", () => {
  it("adds six months to an ordinary date", () => {
    expect(staleDate("2026-12-10")).toBe("2027-06-10");
    expect(staleDate("2026-01-15")).toBe("2026-07-15");
  });

  it("keeps the end of the month: 31 Aug becomes 28 Feb", () => {
    expect(staleDate("2026-08-31")).toBe("2027-02-28");
    expect(staleDate("2026-12-31")).toBe("2027-06-30");
    expect(staleDate("2026-03-31")).toBe("2026-09-30");
  });

  it("knows leap years: 31 Aug 2027 becomes 29 Feb 2028, and 29 Feb 2028 becomes 29 Aug 2028", () => {
    expect(staleDate("2027-08-31")).toBe("2028-02-29");
    expect(staleDate("2027-08-30")).toBe("2028-02-29");
    expect(staleDate("2028-02-29")).toBe("2028-08-29");
    expect(staleDate("2028-08-29")).toBe("2029-02-28");
  });

  it("crosses the year", () => {
    expect(staleDate("2026-11-30")).toBe("2027-05-30");
    expect(staleDate("2026-07-01")).toBe("2027-01-01");
  });

  it("refuses something that is not a real day", () => {
    expect(() => staleDate("2026-02-31")).toThrow();
  });
});

describe("status changes", () => {
  const all = CHEQUE_STATUSES;
  const allowed = (from: ChequeStatus) => all.filter((to) => canMove(from, to));

  it("waiting goes to deposited, or ends as bounced or cancelled", () => {
    expect(allowed("waiting")).toEqual(["deposited", "bounced", "cancelled"]);
  });

  it("deposited goes to cleared, ends as bounced or cancelled, or goes back to waiting", () => {
    expect(allowed("deposited")).toEqual(["waiting", "cleared", "bounced", "cancelled"]);
  });

  it("a finished cheque can only be put back to waiting (to correct a mistake)", () => {
    for (const s of ["cleared", "bounced", "cancelled"] as const) expect(allowed(s)).toEqual(["waiting"]);
  });

  it("nothing moves to itself, and waiting cannot jump to cleared", () => {
    for (const s of all) expect(canMove(s, s)).toBe(false);
    expect(canMove("waiting", "cleared")).toBe(false);
  });
});

describe("viewOf: how a cheque stands today", () => {
  const cheque = { status: "waiting" as const, chequeDate: "2026-12-10" };

  it("waiting: the date is ahead, the ring counts the days to deposit", () => {
    const v = viewOf(cheque, "2026-11-24");
    expect(v.state).toBe("waiting");
    expect(v.ring).toEqual({ days: 16, ofDays: 365 });
    expect(v.chip).toBe("Can be deposited 10 Dec");
    expect(v.staleOn).toBe("2027-06-10");
    expect(v.spoken).toBe("16 days until it can be deposited");
  });

  it("the day it can be deposited", () => {
    const v = viewOf(cheque, "2026-12-10");
    expect(v.state).toBe("today");
    expect(v.chip).toBe("Deposit today");
  });

  it("late: the date passed, the ring shows the days late, and it says to deposit now", () => {
    const v = viewOf(cheque, "2026-12-14");
    expect(v.state).toBe("late");
    expect(v.ring).toEqual({ days: -4, ofDays: 30 });
    expect(v.spoken).toBe("4 days late, deposit it now");
    expect(viewOf(cheque, "2026-12-11").spoken).toBe("1 day late, deposit it now");
  });

  it("going stale: inside the last 30 days, the ring counts down to the stale date", () => {
    expect(viewOf(cheque, "2027-05-10").state).toBe("late"); // 31 days to go: not yet "going stale"
    const v = viewOf(cheque, "2027-05-11");
    expect(v.state).toBe("going-stale");
    expect(v.ring).toEqual({ days: 30, ofDays: 30 });
    expect(viewOf(cheque, "2027-05-11").chip).toBe("Goes stale in 30 days");
    expect(viewOf(cheque, "2027-06-09").chip).toBe("Goes stale in 1 day");
    expect(viewOf(cheque, "2027-06-10").chip).toBe("Goes stale today");
    expect(viewOf(cheque, "2027-06-10").state).toBe("going-stale");
  });

  it("stale: the day after the stale date", () => {
    const v = viewOf(cheque, "2027-06-11");
    expect(v.state).toBe("stale");
    expect(v.ring).toEqual({ days: -1, ofDays: 30 });
    expect(v.chip).toBe("Went stale");
  });

  it("a cheque that is not waiting has no ring: its status is what it says", () => {
    for (const status of ["deposited", "cleared", "bounced", "cancelled"] as const) {
      const v = viewOf({ status, chequeDate: "2026-12-10" }, "2027-08-01");
      expect(v.state).toBe(status);
      expect(v.ring).toBeNull();
    }
  });

  it("the stale line says goes or went", () => {
    expect(staleLine("2027-06-10", "2026-11-24")).toBe("Goes stale 10 Jun 2027");
    expect(staleLine("2026-12-10", "2026-11-24")).toBe("Goes stale 10 Dec");
    expect(staleLine("2026-11-01", "2026-11-24")).toBe("Went stale 1 Nov");
  });
});

describe("grouping and order", () => {
  const row = (id: string, status: ChequeStatus, chequeDate: string, depositedOn: string | null = null) => ({ id, status, chequeDate, depositedOn });
  const rows = [
    row("a", "waiting", "2026-12-20"),
    row("b", "waiting", "2026-12-01"),
    row("c", "deposited", "2026-11-01", "2026-11-20"),
    row("d", "deposited", "2026-11-05", "2026-11-10"),
    row("e", "cleared", "2026-10-01", "2026-10-02"),
    row("f", "bounced", "2026-10-15", "2026-10-16"),
    row("g", "cancelled", "2026-09-01"),
  ];

  it("waiting: the earliest date first", () => expect(waitingFirst(rows).map((r) => r.id)).toEqual(["b", "a"]));
  it("deposited: the longest in the bank first", () => expect(inTheBank(rows).map((r) => r.id)).toEqual(["d", "c"]));
  it("finished: the latest cheque date first", () => expect(finished(rows).map((r) => r.id)).toEqual(["f", "e", "g"]));
});
