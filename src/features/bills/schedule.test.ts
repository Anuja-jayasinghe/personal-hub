import { describe, expect, it } from "vitest";
import {
  addMonthsKeepingDay,
  anchorDayOf,
  billDateOf,
  billDayMeta,
  billDayWording,
  daysInMonth,
  isFrequency,
  markPaidHelp,
  nextBillDayAfter,
  nextDueAfter,
  paymentFor,
  payableFrom,
  payRefusal,
  rollForward,
  titleWithBill,
} from "./schedule";

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

describe("nextBillDayAfter", () => {
  it("is the next bill day after today: the date the bill that arrived must be paid by", () => {
    expect(nextBillDayAfter("2026-11-19", 5)).toBe("2026-12-05");
    expect(nextBillDayAfter("2026-11-19", 25)).toBe("2026-11-25");
    expect(nextBillDayAfter("2026-11-19", 19)).toBe("2026-12-19");
    expect(nextBillDayAfter("2026-01-31", 31)).toBe("2026-02-28");
    expect(nextBillDayAfter("2026-12-20", 3)).toBe("2027-01-03");
  });
});

describe("payableFrom", () => {
  const bill = { kind: "bill" as const, frequency: "monthly" as const, autopay: false, anchorDay: 6 };
  it("is the day after the previous bill day for a monthly bill", () => {
    expect(payableFrom(bill, "2026-12-06")).toBe("2026-11-07");
    expect(payableFrom(bill, "2027-01-06")).toBe("2026-12-07");
    expect(payableFrom({ ...bill, anchorDay: 31 }, "2027-02-28")).toBe("2027-02-01");
    expect(payableFrom({ ...bill, anchorDay: null }, "2027-01-06")).toBe("2026-12-07");
  });
  it("is null when the date is simply the date to pay by", () => {
    expect(payableFrom({ ...bill, kind: "subscription" }, "2027-01-06")).toBeNull();
    expect(payableFrom({ ...bill, autopay: true }, "2027-01-06")).toBeNull();
    expect(payableFrom({ ...bill, frequency: "yearly" }, "2027-01-06")).toBeNull();
    expect(payableFrom({ ...bill, frequency: "one_off" }, "2027-01-06")).toBeNull();
  });
});

describe("billDateOf (bill dates for a bill-day item)", () => {
  const bill = { kind: "bill" as const, frequency: "monthly" as const, autopay: false, anchorDay: 6 };
  it("is the pay-by date minus one month, keeping the bill day", () => {
    expect(billDateOf(bill, "2026-12-06")).toBe("2026-11-06");
    expect(billDateOf(bill, "2027-01-06")).toBe("2026-12-06");
    expect(billDateOf({ ...bill, anchorDay: null }, "2027-01-06")).toBe("2026-12-06");
  });
  it("keeps a month-end bill day through short months", () => {
    expect(billDateOf({ ...bill, anchorDay: 31 }, "2027-02-28")).toBe("2027-01-31");
    expect(billDateOf({ ...bill, anchorDay: 31 }, "2027-03-31")).toBe("2027-02-28");
    expect(billDateOf({ ...bill, anchorDay: 31 }, "2028-03-31")).toBe("2028-02-29");
    expect(billDateOf({ ...bill, anchorDay: 31 }, "2027-01-31")).toBe("2026-12-31");
  });
  it("is null for every other item, which keeps the due-date wording", () => {
    expect(billDateOf({ ...bill, kind: "subscription" }, "2027-01-06")).toBeNull();
    expect(billDateOf({ ...bill, autopay: true }, "2027-01-06")).toBeNull();
    for (const frequency of ["weekly", "quarterly", "yearly", "one_off"] as const) expect(billDateOf({ ...bill, frequency }, "2027-01-06")).toBeNull();
  });
  it("payableFrom is the day after the bill date", () => {
    expect(payableFrom(bill, "2027-01-06")).toBe("2026-12-07");
    expect(payableFrom({ ...bill, anchorDay: 31 }, "2027-03-31")).toBe("2027-03-01");
  });
});

describe("payRefusal (the guard behind Mark paid)", () => {
  const slt = { kind: "bill" as const, frequency: "monthly" as const, autopay: false, anchorDay: 6, nextDueDate: "2027-01-06" as string | null };
  it("refuses before the bill is payable, with the reason", () => {
    expect(payRefusal(slt, "2026-11-24")).toBe("The 6 Dec bill is processed on 6 Dec and can be paid from 7 Dec.");
    expect(payRefusal(slt, "2026-12-01")).not.toBeNull();
  });
  it("refuses on the bill day itself: it is processed that day and payable the next", () => {
    expect(payRefusal(slt, "2026-12-06")).toBe("The 6 Dec bill is processed on 6 Dec and can be paid from 7 Dec.");
    expect(payRefusal(slt, "2026-12-07")).toBeNull();
    expect(payRefusal(slt, "2027-01-06")).toBeNull(); // on the pay-by date, and later (late)
    expect(payRefusal(slt, "2027-02-01")).toBeNull();
  });
  it("lets the November bill be paid now (its pay-by date is 6 Dec)", () => {
    expect(payRefusal({ ...slt, nextDueDate: "2026-12-06" }, "2026-11-24")).toBeNull();
  });
  it("handles month-end bill days", () => {
    const end = { ...slt, anchorDay: 31, nextDueDate: "2027-02-28" };
    expect(payRefusal(end, "2027-01-31")).toBe("The 31 Jan bill is processed on 31 Jan and can be paid from 1 Feb.");
    expect(payRefusal(end, "2027-02-01")).toBeNull();
  });
  it("never refuses other items or a finished one", () => {
    expect(payRefusal({ ...slt, kind: "subscription" }, "2026-11-24")).toBeNull();
    expect(payRefusal({ ...slt, autopay: true }, "2026-11-24")).toBeNull();
    expect(payRefusal({ ...slt, frequency: "yearly" }, "2026-11-24")).toBeNull();
    expect(payRefusal({ ...slt, frequency: "one_off" }, "2026-11-24")).toBeNull();
    expect(payRefusal({ ...slt, nextDueDate: null }, "2026-11-24")).toBeNull();
  });
});

describe("the wording in bill dates", () => {
  const slt = { kind: "bill" as const, frequency: "monthly" as const, autopay: false, anchorDay: 6 };
  const long = (ymd: string) => `<${ymd}>`;
  it("card: not payable yet says the next bill and when it is payable", () => {
    expect(billDayWording(slt, "2027-01-06", "2026-11-24")).toEqual({ payable: false, nextBill: "6 Dec", payableFrom: "7 Dec" });
    expect(billDayWording(slt, "2027-01-06", "2026-12-06")).toEqual({ payable: false, nextBill: "6 Dec", payableFrom: "7 Dec" });
  });
  it("card: payable says the bill of and the pay-by date", () => {
    expect(billDayWording(slt, "2026-12-06", "2026-11-24")).toEqual({ payable: true, billOf: "6 Nov", payBy: "6 Dec" });
    expect(billDayWording(slt, "2027-01-06", "2026-12-07")).toEqual({ payable: true, billOf: "6 Dec", payBy: "6 Jan 2027" }); // next year: the year shows
  });
  it("card: other items have no bill-date wording", () => {
    expect(billDayWording({ ...slt, kind: "subscription" }, "2027-01-06", "2026-11-24")).toBeNull();
    expect(billDayWording({ ...slt, frequency: "weekly" }, "2027-01-06", "2026-11-24")).toBeNull();
  });
  it("list meta and calendar title", () => {
    expect(billDayMeta("2026-11-06", "2026-12-06", "2026-11-24")).toBe("6 Nov bill · pay by 6 Dec");
    expect(titleWithBill("SLT Fibre", "2026-11-06", "2026-11-24")).toBe("SLT Fibre · 6 Nov bill");
    expect(titleWithBill("Netflix", null, "2026-11-24")).toBe("Netflix");
    expect(titleWithBill("Netflix", undefined, "2026-11-24")).toBe("Netflix");
  });
  it("Mark paid help: bill dates for a bill-day item, the old text for the rest", () => {
    expect(markPaidHelp({ ...slt, nextDueDate: "2026-12-06" }, long, "2026-11-24")).toBe("Records a payment for the 6 Nov bill and moves on to the 6 Dec bill.");
    expect(markPaidHelp({ ...slt, frequency: "yearly", nextDueDate: "2026-12-06" }, long, "2026-11-24")).toBe("Records a payment for the <2026-12-06> due date and moves the next due date forward.");
    expect(markPaidHelp({ ...slt, frequency: "one_off", nextDueDate: "2026-12-06" }, long, "2026-11-24")).toBe("Records a payment for the <2026-12-06> due date and marks this item done.");
    expect(markPaidHelp({ ...slt, kind: "subscription", nextDueDate: "2026-12-06" }, long, "2026-11-24")).toBe("Records a payment for the <2026-12-06> due date and moves the next due date forward.");
  });
  it("payment history: the SLT payment settled the 6 Nov bill", () => {
    expect(paymentFor(slt, "2026-12-06", long, "2026-11-24")).toBe("the 6 Nov bill");
    expect(paymentFor({ ...slt, autopay: true }, "2026-12-06", long, "2026-11-24")).toBe("the <2026-12-06> due date");
  });
});

describe("the year is written only when it is not this year (issue #42)", () => {
  const slt = { kind: "bill" as const, frequency: "monthly" as const, autopay: false, anchorDay: 6 };
  const long = (ymd: string) => `<${ymd}>`;
  it("card: a bill date in the next year carries its year", () => {
    // Today is 20 Dec 2026: the bill due by 6 Feb 2027 is the 6 Jan 2027 bill, payable from 7 Jan 2027.
    expect(billDayWording(slt, "2027-02-06", "2026-12-20")).toEqual({ payable: false, nextBill: "6 Jan 2027", payableFrom: "7 Jan 2027" });
    // The 6 Dec bill (this year) is payable now and is paid by 6 Jan 2027.
    expect(billDayWording(slt, "2027-01-06", "2026-12-20")).toEqual({ payable: true, billOf: "6 Dec", payBy: "6 Jan 2027" });
  });
  it("the same dates read without a year once it is that year", () => {
    expect(billDayWording(slt, "2027-02-06", "2027-01-20")).toEqual({ payable: true, billOf: "6 Jan", payBy: "6 Feb" });
  });
  it("list meta, calendar title, Mark paid help and payment history follow the same rule", () => {
    expect(billDayMeta("2026-12-06", "2027-01-06", "2026-12-20")).toBe("6 Dec bill · pay by 6 Jan 2027");
    expect(billDayMeta("2026-12-06", "2027-01-06", "2027-01-02")).toBe("6 Dec 2026 bill · pay by 6 Jan");
    expect(titleWithBill("SLT Fibre", "2027-01-06", "2026-12-20")).toBe("SLT Fibre · 6 Jan 2027 bill");
    expect(markPaidHelp({ ...slt, nextDueDate: "2027-01-06" }, long, "2026-12-20")).toBe("Records a payment for the 6 Dec bill and moves on to the 6 Jan 2027 bill.");
    expect(paymentFor(slt, "2027-01-06", long, "2027-01-20")).toBe("the 6 Dec 2026 bill");
  });
  it("the Mark paid refusal names the year of a date outside this year", () => {
    const item = { ...slt, nextDueDate: "2027-02-06" as string | null };
    expect(payRefusal(item, "2026-12-20")).toBe("The 6 Jan 2027 bill is processed on 6 Jan 2027 and can be paid from 7 Jan 2027.");
  });
});
