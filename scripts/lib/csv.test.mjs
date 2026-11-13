import { describe, expect, it } from "vitest";
import { csvField, toCsv } from "./csv.mjs";
import { buildElectricityCsv } from "./electricity-csv.mjs";

describe("csvField", () => {
  it("leaves plain values alone and writes nothing for null", () => {
    expect(csvField("abc")).toBe("abc");
    expect(csvField(12.5)).toBe("12.5");
    expect(csvField("1200.50")).toBe("1200.50");
    expect(csvField(null)).toBe("");
    expect(csvField(undefined)).toBe("");
  });

  it("quotes commas, quotes, line breaks and edge spaces, doubling quotes", () => {
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("two\nlines")).toBe('"two\nlines"');
    expect(csvField("two\r\nlines")).toBe('"two\r\nlines"');
    expect(csvField(" padded")).toBe('" padded"');
    expect(csvField("padded ")).toBe('"padded "');
  });

  it("neutralises formulas only in text fields", () => {
    expect(csvField("=SUM(A1)", { text: true })).toBe("'=SUM(A1)");
    expect(csvField("+1", { text: true })).toBe("'+1");
    expect(csvField("-1", { text: true })).toBe("'-1");
    expect(csvField("@x", { text: true })).toBe("'@x");
    expect(csvField("\tx", { text: true })).toBe("'\tx");
    expect(csvField("-5")).toBe("-5"); // a number column is not touched
    expect(csvField("fine", { text: true })).toBe("fine");
  });
});

describe("toCsv", () => {
  const columns = [
    { header: "name", get: (r) => r.name, text: true },
    { header: "kwh", get: (r) => r.kwh },
  ];

  it("starts with a byte-order mark, uses CRLF and ends with a line break", () => {
    const out = toCsv(columns, [{ name: "Main, house", kwh: "10.50" }, { name: "Shed", kwh: null }]);
    expect(out).toBe('﻿name,kwh\r\n"Main, house",10.50\r\nShed,\r\n');
  });

  it("has the header even with no rows", () => {
    expect(toCsv(columns, [])).toBe("﻿name,kwh\r\n");
  });
});

describe("buildElectricityCsv", () => {
  const meters = [{ name: "Main", account_number: "0123", archived_at: null, notes: null }];
  const readings = [
    { meter_name: "Main", reading_date: "2026-11-12", value: "15.00", replaced_final_value: null, source: "manual", note: "a, b" },
    { meter_name: "Main", reading_date: "2026-11-09", value: "0.00", replaced_final_value: "1060.00", source: "manual", note: null },
  ];
  const bills = [
    {
      meter_name: "Main",
      bill_date: "2026-11-01",
      reading_date: "2026-10-30",
      previous_reading: "900.00",
      current_reading: "1000.00",
      units: "100.00",
      amount: "4850.50",
      due_date: "2026-11-15",
      paid_date: null,
      notes: "=cmd",
    },
  ];

  it("writes the three files with the documented columns", () => {
    const files = buildElectricityCsv({ meters, readings, bills });
    expect(Object.keys(files)).toEqual(["meters.csv", "readings.csv", "bills.csv"]);
    expect(files["meters.csv"]).toBe("﻿meter,account_number,archived,notes\r\nMain,0123,no,\r\n");
    expect(files["readings.csv"]).toBe(
      "﻿meter,reading_date,reading_kwh,meter_replaced,old_meter_final_kwh,source,note\r\n" +
        'Main,2026-11-12,15.00,no,,manual,"a, b"\r\n' +
        "Main,2026-11-09,0.00,yes,1060.00,manual,\r\n",
    );
    expect(files["bills.csv"]).toBe(
      "﻿meter,bill_date,reading_date,previous_reading_kwh,current_reading_kwh,units_kwh,amount,due_date,paid_date,notes\r\n" +
        "Main,2026-11-01,2026-10-30,900.00,1000.00,100.00,4850.50,2026-11-15,,'=cmd\r\n",
    );
  });

  it("marks an archived meter", () => {
    const files = buildElectricityCsv({ meters: [{ ...meters[0], archived_at: new Date() }], readings: [], bills: [] });
    expect(files["meters.csv"]).toContain("Main,0123,yes,");
  });
});
