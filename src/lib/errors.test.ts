import { describe, expect, it } from "vitest";
import { safeErrorSummary } from "./errors";

describe("safeErrorSummary", () => {
  it("gives the name and the database code, never the message or the parameters", () => {
    const cause = Object.assign(new Error('duplicate key value violates unique constraint'), { code: "23505" });
    const err = Object.assign(new Error("Failed query: insert ... params: owner@example.com,Pay LKR 25,000"), { name: "DrizzleQueryError", cause });
    expect(safeErrorSummary(err)).toBe("DrizzleQueryError (23505)");
    expect(safeErrorSummary(new TypeError("owner@example.com"))).toBe("TypeError");
  });

  it("ignores codes that are not short tokens, and non-errors", () => {
    expect(safeErrorSummary(Object.assign(new Error("x"), { code: "owner@example.com" }))).toBe("Error");
    expect(safeErrorSummary("owner@example.com")).toBe("string");
  });
});
