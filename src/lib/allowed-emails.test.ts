import { describe, expect, it } from "vitest";
import { isAllowedEmail, parseAllowedEmails } from "./allowed-emails";

describe("parseAllowedEmails", () => {
  it("splits on commas, semicolons and whitespace and lowercases", () => {
    expect(parseAllowedEmails("Me@Example.com, you@x.org;  third@y.io\nfourth@z.lk")).toEqual([
      "me@example.com",
      "you@x.org",
      "third@y.io",
      "fourth@z.lk",
    ]);
  });
  it("drops empty entries and anything that is not an address", () => {
    expect(parseAllowedEmails(",, nobody, @x.com, a@, a b@c.com ,ok@ok.com")).toEqual(["b@c.com", "ok@ok.com"]);
  });
  it("is empty for nothing", () => {
    expect(parseAllowedEmails(undefined)).toEqual([]);
    expect(parseAllowedEmails("")).toEqual([]);
    expect(parseAllowedEmails("   ")).toEqual([]);
  });
});

describe("isAllowedEmail", () => {
  const list = ["me@example.com"];
  it("allows a listed address, ignoring case and surrounding spaces", () => {
    expect(isAllowedEmail("me@example.com", list)).toBe(true);
    expect(isAllowedEmail(" ME@Example.COM ", list)).toBe(true);
  });
  it("refuses anything else, including look-alikes", () => {
    expect(isAllowedEmail("you@example.com", list)).toBe(false);
    expect(isAllowedEmail("me@example.com.evil.io", list)).toBe(false);
    expect(isAllowedEmail("xme@example.com", list)).toBe(false);
  });
  it("fails closed: no email, or an empty list, allows nobody", () => {
    expect(isAllowedEmail(null, list)).toBe(false);
    expect(isAllowedEmail(undefined, list)).toBe(false);
    expect(isAllowedEmail("", list)).toBe(false);
    expect(isAllowedEmail("me@example.com", [])).toBe(false);
  });
});
