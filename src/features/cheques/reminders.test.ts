import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { computeReminders } from "@/features/reminders/engine";
import { chequeReminders } from "./reminders";

const c = { id: "11111111-1111-4111-8111-111111111111", fromParty: "Made-Up Traders", amount: "25000.50", chequeDate: "2026-12-10" };
const plain = (s: string) => s.replace(/\u00a0/g, " ");
const LEADS = [30, 14, 7, 1, 0];

describe("chequeReminders", () => {
  it("makes two reminders: the cheque date and the stale date, six months later", () => {
    const items = chequeReminders([c], "2026-11-24");
    expect(items.map((i) => [i.id, i.dueDate, i.kind])).toEqual([
      [`cheque:${c.id}`, "2026-12-10", "cheque"],
      [`cheque-stale:${c.id}`, "2027-06-10", "stale cheque"],
    ]);
  });

  it("titles may name who and the amount (the owner's own screen); the notification words never do", () => {
    const [deposit, stale] = chequeReminders([c], "2026-11-24");
    expect(plain(deposit.title)).toBe("Deposit cheque · Made-Up Traders · LKR 25,000.50");
    expect(plain(stale.title)).toBe("Cheque goes stale · Made-Up Traders · LKR 25,000.50");
    expect(deposit.notice).toEqual({ what: "Cheque" });
    expect(stale.notice).toEqual({ what: "Cheque" });
  });

  it("links to the cheque on the Cheques page and carries its id as the owner", () => {
    for (const i of chequeReminders([c], "2026-11-24")) {
      expect(i.href).toBe(`/cheques#cheque-${c.id}`);
      expect(i.ownerId).toBe(c.id);
    }
  });

  it("the deposit reminder shows from the app-wide lead days and stays overdue every day after", () => {
    const [deposit] = chequeReminders([c], "2026-11-24");
    const level = (today: string) => computeReminders([deposit], today, LEADS)[0]?.level;
    expect(level("2026-11-09")).toBeUndefined(); // 31 days ahead: not shown yet
    expect(level("2026-11-10")).toBe("upcoming"); // 30 days
    expect(level("2026-12-03")).toBe("soon");
    expect(level("2026-12-10")).toBe("today");
    expect(level("2026-12-11")).toBe("overdue");
    expect(level("2027-03-01")).toBe("overdue");
    expect(level("2027-06-10")).toBe("overdue");
  });

  it("the stale reminder shows from 30 days before the stale date", () => {
    const [, stale] = chequeReminders([c], "2026-11-24");
    const level = (today: string) => computeReminders([stale], today, LEADS)[0]?.level;
    expect(level("2027-05-10")).toBeUndefined();
    expect(level("2027-05-11")).toBe("upcoming");
    expect(level("2027-06-10")).toBe("today");
  });

  it("after the stale date only the stale reminder is left, overdue, with 'went stale' in its title", () => {
    const items = chequeReminders([c], "2027-06-11");
    expect(items.map((i) => i.id)).toEqual([`cheque-stale:${c.id}`]);
    expect(plain(items[0].title)).toBe("Cheque went stale · Made-Up Traders · LKR 25,000.50");
    expect(computeReminders(items, "2027-06-11", LEADS)[0].level).toBe("overdue");
  });

  it("on the stale date itself the cheque can still be taken, so both are listed", () => {
    expect(chequeReminders([c], "2027-06-10")).toHaveLength(2);
  });

  it("uses the end-of-month rule for the stale date (31 Aug, leap years)", () => {
    const stales = chequeReminders(
      [
        { ...c, id: "a", chequeDate: "2026-08-31" },
        { ...c, id: "b", chequeDate: "2027-08-31" },
      ],
      "2026-08-01",
    ).filter((i) => i.id.startsWith("cheque-stale"));
    expect(stales.map((i) => i.dueDate)).toEqual(["2027-02-28", "2028-02-29"]);
  });

  it("nothing for no cheques", () => expect(chequeReminders([], "2026-11-24")).toEqual([]));
});
