import { describe, expect, it } from "vitest";
import { looksLikeCardNumber, parseBillItem } from "./validate";

const ok = (raw: Record<string, string>) => {
  const r = parseBillItem(raw);
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`);
  return r.value;
};
const err = (raw: Record<string, string>) => {
  const r = parseBillItem(raw);
  if (r.ok) throw new Error("expected an error");
  return r.error;
};
const base = { name: "Dialog fibre", frequency: "monthly", nextDueDate: "2026-11-25" };

describe("parseBillItem", () => {
  it("accepts a minimal item (a bill, not on autopay)", () => {
    expect(ok(base)).toEqual({
      kind: "bill",
      name: "Dialog fibre",
      frequency: "monthly",
      nextDueDate: "2026-11-25",
      amount: null,
      autopay: false,
      paymentMethod: null,
      notes: null,
    });
  });

  it("accepts a full subscription", () => {
    expect(ok({ ...base, kind: "subscription", name: "  Netflix  ", amount: "1,490.50", autopay: "on", paymentMethod: " Visa,  Sampath ", notes: " family plan " })).toMatchObject({
      kind: "subscription",
      name: "Netflix",
      amount: "1490.50",
      autopay: true,
      paymentMethod: "Visa, Sampath",
      notes: "family plan",
    });
  });

  it("requires a name, a known frequency and a real next due date", () => {
    expect(err({ ...base, name: "  " })).toMatch(/Name is required/);
    expect(err({ ...base, name: "x".repeat(81) })).toMatch(/at most 80/);
    expect(err({ ...base, frequency: "daily" })).toMatch(/how often/);
    expect(err({ ...base, frequency: "" })).toMatch(/how often/);
    expect(err({ ...base, nextDueDate: "" })).toMatch(/required/);
    expect(err({ ...base, nextDueDate: "2026-02-31" })).toMatch(/valid date/);
    expect(err({ ...base, kind: "loan" })).toMatch(/bill or a subscription/);
  });

  it("checks the amount", () => {
    expect(err({ ...base, amount: "-5" })).toMatch(/Amount must be/);
    expect(err({ ...base, amount: "12.345" })).toMatch(/Amount must be/);
    expect(ok({ ...base, amount: "0" }).amount).toBe("0");
  });

  it("refuses anything that looks like a card number, in the payment method or the notes", () => {
    expect(err({ ...base, paymentMethod: "4111 1111 1111 1111" })).toMatch(/card number/);
    expect(err({ ...base, paymentMethod: "4111-1111-1111-1111" })).toMatch(/card number/);
    expect(err({ ...base, paymentMethod: "4111111111111111" })).toMatch(/card number/);
    expect(err({ ...base, notes: "my card 5500 0000 0000 0004 expires soon" })).toMatch(/card number/);
    expect(ok({ ...base, paymentMethod: "Visa ending 1234" }).paymentMethod).toBe("Visa ending 1234");
    expect(ok({ ...base, notes: "account 0123456789 (10 digits)" }).notes).toBe("account 0123456789 (10 digits)");
  });

  it("limits the payment method and notes", () => {
    expect(err({ ...base, paymentMethod: "x".repeat(61) })).toMatch(/at most 60/);
    expect(err({ ...base, notes: "x".repeat(501) })).toMatch(/at most 500/);
  });
});

describe("looksLikeCardNumber", () => {
  it("needs 13 to 19 digits in a row", () => {
    expect(looksLikeCardNumber("1234567890123")).toBe(true); // 13
    expect(looksLikeCardNumber("1234567890123456789")).toBe(true); // 19
    expect(looksLikeCardNumber("123456789012")).toBe(false); // 12
    expect(looksLikeCardNumber("Visa ending 1234")).toBe(false);
  });
});

describe("parseBillItem with a bill day (S.5)", () => {
  it("turns the day the bill arrives into the next due date, and keeps the day", () => {
    const r = parseBillItem({ name: "Water", frequency: "monthly", billDay: "5" }, "2026-11-19");
    expect(r).toMatchObject({ ok: true, value: { nextDueDate: "2026-12-05", anchorDay: 5 } });
  });
  it("refuses a day outside 1 to 31, and ignores a bill day on a yearly item", () => {
    expect(parseBillItem({ name: "Water", frequency: "monthly", billDay: "32" }, "2026-11-19")).toMatchObject({ ok: false });
    expect(parseBillItem({ name: "Car tax", frequency: "yearly", billDay: "5", nextDueDate: "2027-03-01" }, "2026-11-19")).toMatchObject({
      ok: true,
      value: { nextDueDate: "2027-03-01" },
    });
  });
  it("asks for the due date of a one-time bill", () => {
    expect(parseBillItem({ name: "Plumber", frequency: "one_off" }, "2026-11-19")).toMatchObject({ ok: false, error: "The due date is required." });
  });
});
