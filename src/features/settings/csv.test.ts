import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it("quotes commas, quotes and line breaks, and leaves plain values alone", () => {
    expect(csvCell("Dialog, fibre")).toBe('"Dialog, fibre"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell(1500.5)).toBe("1500.5");
    expect(csvCell(null)).toBe("");
    expect(csvCell(true)).toBe("yes");
  });
  it("defuses text a spreadsheet would run as a formula, but not negative numbers", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("-5 units")).toBe("'-5 units");
    expect(csvCell(-5)).toBe("-5");
  });
});

describe("toCsv", () => {
  it("writes a header and rows with Windows line ends", () => {
    expect(toCsv(["a", "b"], [[1, "x"], [2, null]])).toBe("a,b\r\n1,x\r\n2,\r\n");
  });
});
