import { describe, expect, it } from "vitest";
import { depositedOnAfter, parseCheque, parseStatusChange } from "./validate";

const TODAY = "2026-11-24";
const ok = { fromParty: "Made-Up Traders", amount: "25,000.50", chequeDate: "2027-02-10" };

describe("parseCheque", () => {
  it("accepts the three required parts and tidies them", () => {
    const r = parseCheque({ ...ok, fromParty: "  Made-Up   Traders ", bank: "", chequeNumber: " ", note: "" }, TODAY);
    expect(r).toEqual({ ok: true, value: { fromParty: "Made-Up Traders", amount: "25000.50", bank: null, chequeNumber: null, chequeDate: "2027-02-10", note: null } });
  });

  it("keeps the optional parts when given", () => {
    const r = parseCheque({ ...ok, bank: "Sampath", chequeNumber: "004 512", note: "roof job" }, TODAY);
    expect(r.ok && r.value).toMatchObject({ bank: "Sampath", chequeNumber: "004 512", note: "roof job" });
  });

  it.each([
    [{ fromParty: " " }, /Who gave you/],
    [{ fromParty: "x".repeat(81) }, /at most 80/],
    [{ amount: "" }, /amount is required/],
    [{ amount: "abc" }, /must be a number/],
    [{ amount: "12.345" }, /must be a number/],
    [{ amount: "-5" }, /must be a number/],
    [{ amount: "0" }, /more than zero/],
    [{ amount: "0.00" }, /more than zero/],
    [{ amount: "1".repeat(13) }, /must be a number/],
    [{ chequeDate: "" }, /date is required/],
    [{ chequeDate: "2027-02-30" }, /valid date/],
    [{ chequeDate: "10/02/2027" }, /valid date/],
    [{ bank: "b".repeat(61) }, /bank must be at most 60/],
    [{ chequeNumber: "n".repeat(21) }, /at most 20/],
    [{ chequeNumber: "12;DROP" }, /letters, digits/],
    [{ chequeNumber: "4111 1111 1111 1111" }, /at most 20|card number/],
    [{ chequeNumber: "4111111111111111" }, /card number/],
    [{ note: "n".repeat(301) }, /at most 300/],
    [{ note: "my card 4111 1111 1111 1111" }, /card number/],
  ])("refuses %j", (bad, message) => {
    const r = parseCheque({ ...ok, ...bad }, TODAY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(message);
  });

  it("never repeats what was typed in an error", () => {
    for (const bad of [{ amount: "SECRET-9" }, { chequeNumber: "4111111111111111" }, { note: "4111 1111 1111 1111" }]) {
      const r = parseCheque({ ...ok, ...bad }, TODAY);
      expect(!r.ok && r.error).not.toMatch(/SECRET|4111/);
    }
  });

  it("catches a mistyped year but lets an old, unchanged date through when editing", () => {
    expect(parseCheque({ ...ok, chequeDate: "2062-02-10" }, TODAY)).toEqual({ ok: false, error: "That cheque date is more than two years away. Check the year." });
    expect(parseCheque({ ...ok, chequeDate: "2025-02-10" }, TODAY)).toEqual({ ok: false, error: "That cheque date is more than a year ago. Check the year." });
    expect(parseCheque({ ...ok, chequeDate: "2025-02-10" }, TODAY, "2025-02-10").ok).toBe(true); // editing the note of an old cheque
    expect(parseCheque({ ...ok, chequeDate: "2025-03-10" }, TODAY, "2025-02-10").ok).toBe(false); // but moving it to another old date is checked
    expect(parseCheque({ ...ok, chequeDate: "2026-11-24" }, TODAY).ok).toBe(true); // today
    expect(parseCheque({ ...ok, chequeDate: "2025-11-24" }, TODAY).ok).toBe(true); // exactly a year back
    expect(parseCheque({ ...ok, chequeDate: "2028-11-23" }, TODAY).ok).toBe(true); // just under two years ahead
  });
});

describe("parseStatusChange", () => {
  it("marks deposited on the day given, or today when none is", () => {
    expect(parseStatusChange({ status: "deposited", depositedOn: "2026-11-20" }, TODAY)).toEqual({ ok: true, value: { status: "deposited", depositedOn: "2026-11-20" } });
    expect(parseStatusChange({ status: "deposited" }, TODAY)).toEqual({ ok: true, value: { status: "deposited", depositedOn: TODAY } });
    expect(parseStatusChange({ status: "deposited", depositedOn: " " }, TODAY)).toEqual({ ok: true, value: { status: "deposited", depositedOn: TODAY } });
  });

  it("refuses a deposit date in the future or one that is not a day", () => {
    expect(parseStatusChange({ status: "deposited", depositedOn: "2026-11-25" }, TODAY)).toEqual({ ok: false, error: "The deposit date cannot be in the future." });
    expect(parseStatusChange({ status: "deposited", depositedOn: "2026-02-30" }, TODAY)).toEqual({ ok: false, error: "The deposit date must be a valid date." });
  });

  it("takes any other status as it is, ignoring a date sent with it", () => {
    for (const status of ["waiting", "cleared", "bounced", "cancelled"]) {
      expect(parseStatusChange({ status, depositedOn: "2026-11-20" }, TODAY)).toEqual({ ok: true, value: { status, depositedOn: null } });
    }
  });

  it("refuses an unknown status", () => {
    for (const status of ["", "paid", "DEPOSITED", undefined]) expect(parseStatusChange({ status }, TODAY).ok).toBe(false);
  });
});

describe("depositedOnAfter", () => {
  const change = (status: "deposited" | "cleared", depositedOn: string | null) => ({ status, depositedOn });
  it("sets the date when deposited, forgets it when back to waiting, keeps it otherwise", () => {
    expect(depositedOnAfter("deposited", change("deposited", "2026-11-20"), null)).toBe("2026-11-20");
    expect(depositedOnAfter("waiting", change("deposited", null), "2026-11-20")).toBeNull();
    expect(depositedOnAfter("cleared", change("cleared", null), "2026-11-20")).toBe("2026-11-20");
    expect(depositedOnAfter("bounced", change("cleared", null), "2026-11-20")).toBe("2026-11-20");
    expect(depositedOnAfter("cancelled", change("cleared", null), null)).toBeNull();
  });
});
