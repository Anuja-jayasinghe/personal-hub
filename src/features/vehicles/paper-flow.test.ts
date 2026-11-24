import { describe, expect, it } from "vitest";
import {
  accessLine,
  defaultFrom,
  defaultUntil,
  EMPTY_PREFILL,
  fileRequired,
  kindsFor,
  paperFileName,
  paperMode,
  parsePaper,
  prefillFrom,
  savingLines,
  spanMonthsOf,
  twinMessage,
  type ParseOptions,
  type PaperCan,
} from "./paper-flow";

/** All the rules of the one flow for papers that the sheet and the server share (V.1b, C148). Everything is made up. */

const BOTH: PaperCan = { records: true, files: true };
const DOCS: PaperCan = { records: false, files: true };
const RECORDS: PaperCan = { records: true, files: false };
const NEITHER: PaperCan = { records: false, files: false };

const OPTS: ParseOptions = {
  today: "2026-11-24",
  renewalTypes: ["Revenue license", "Insurance", "Emission test"],
  ignoreEmissionOdometer: false,
  oil: { oilChangeMonths: 6, oilChangeTypes: ["Oil change", "Full service"] },
};

describe("what each person can do with each kind", () => {
  it("makes the record and keeps the file for a person with both", () => {
    expect(paperMode("license", BOTH)).toBe("record");
    expect(paperMode("service", BOTH)).toBe("record");
    expect(paperMode("book", BOTH)).toBe("document");
    expect(paperMode("other", BOTH)).toBe("document");
  });

  it("only keeps the file for a person who can only add documents, whatever the kind", () => {
    for (const kind of ["license", "insurance", "emission", "service", "book", "other"] as const) expect(paperMode(kind, DOCS)).toBe("document");
  });

  it("only makes records for a person who can only add vehicles: no book, no other", () => {
    expect(paperMode("license", RECORDS)).toBe("record");
    expect(paperMode("service", RECORDS)).toBe("record");
    expect(paperMode("book", RECORDS)).toBeNull();
    expect(paperMode("other", RECORDS)).toBeNull();
    expect(kindsFor(RECORDS).map((k) => k.key)).toEqual(["license", "insurance", "emission", "service"]);
  });

  it("refuses everything for a person with neither", () => {
    for (const kind of ["license", "service", "book", "other"] as const) expect(paperMode(kind, NEITHER)).toBeNull();
    expect(kindsFor(NEITHER)).toEqual([]);
  });

  it("lists the chips in the owner's order", () => {
    expect(kindsFor(BOTH).map((k) => k.label)).toEqual(["Revenue license", "Insurance", "Emission test", "Registration book", "Service invoice", "Other"]);
  });

  it("needs a file only when the file is all that is saved", () => {
    expect(fileRequired("license", BOTH)).toBe(false);
    expect(fileRequired("license", DOCS)).toBe(true);
    expect(fileRequired("book", BOTH)).toBe(true);
  });

  it("says in one line which case applies, and nothing when everything is possible", () => {
    expect(accessLine("license", BOTH)).toBeNull();
    expect(accessLine("book", BOTH)).toBeNull();
    expect(accessLine("license", DOCS)).toMatch(/can add the file, but not the record/);
    expect(accessLine("license", RECORDS)).toMatch(/can add the record, but not the file/);
    expect(accessLine("book", DOCS)).toBeNull();
    expect(accessLine("license", NEITHER)).toMatch(/cannot/);
  });
});

describe("the dates the sheet fills in", () => {
  it("starts the day after the last one ends, or today when there is none", () => {
    expect(defaultFrom({ provider: null, lastExpiry: "2026-03-02", spanMonths: 12 }, "2026-11-24")).toBe("2026-03-03");
    expect(defaultFrom({ provider: null, lastExpiry: "2026-12-31", spanMonths: null }, "2026-11-24")).toBe("2027-01-01");
    expect(defaultFrom(EMPTY_PREFILL.license, "2026-11-24")).toBe("2026-11-24");
  });

  it("ends one year later minus a day", () => {
    expect(defaultUntil("2026-03-03", null)).toBe("2027-03-02");
    expect(defaultUntil("2026-01-01", 12)).toBe("2026-12-31");
    expect(defaultUntil("2026-12-15", null)).toBe("2027-12-14");
  });

  it("ends at the end of the month when the day does not exist a year later (29 Feb)", () => {
    expect(defaultUntil("2024-02-29", 12)).toBe("2025-02-28");
    expect(defaultUntil("2026-08-31", 6)).toBe("2027-02-28");
  });

  it("follows the length of the last record: six months stays six months", () => {
    expect(defaultUntil("2026-03-03", 6)).toBe("2026-09-02");
    expect(spanMonthsOf("2026-03-03", "2027-03-02")).toBe(12);
    expect(spanMonthsOf("2026-03-03", "2026-09-02")).toBe(6);
    expect(spanMonthsOf(null, "2026-09-02")).toBeNull();
    expect(spanMonthsOf("2026-09-03", "2026-03-02")).toBeNull();
  });

  it("is null for something that is not a day", () => {
    expect(defaultUntil("soon", null)).toBeNull();
  });
});

describe("prefilling from the last record of each kind", () => {
  const renewals = [
    { type: "Revenue license", provider: "Old Council", startDate: "2024-03-03", expiryDate: "2025-03-02" },
    { type: "Revenue license", provider: "Test Council", startDate: "2025-03-03", expiryDate: "2026-03-02" },
    { type: "Insurance", provider: "Test Insurer", startDate: "2026-01-01", expiryDate: "2026-06-30" },
    { type: "Insurance", provider: null, startDate: null, expiryDate: "2025-12-31" },
    { type: "Parking permit", provider: "Nobody", startDate: null, expiryDate: "2030-01-01" },
  ];

  it("takes the provider and the end of the record that ends last", () => {
    const p = prefillFrom(renewals);
    expect(p.license).toEqual({ provider: "Test Council", lastExpiry: "2026-03-02", spanMonths: 12 });
    expect(p.insurance).toEqual({ provider: "Test Insurer", lastExpiry: "2026-06-30", spanMonths: 6 });
  });

  it("leaves a kind with no records empty, and ignores types that are not one of the three", () => {
    const p = prefillFrom(renewals);
    expect(p.emission).toEqual({ provider: null, lastExpiry: null, spanMonths: null });
  });

  it("falls back to an older record's provider when the newest has none", () => {
    const p = prefillFrom([
      { type: "Insurance", provider: null, startDate: null, expiryDate: "2026-06-30" },
      { type: "Insurance", provider: "Older Insurer", startDate: null, expiryDate: "2025-06-30" },
    ]);
    expect(p.insurance.provider).toBe("Older Insurer");
    expect(p.insurance.lastExpiry).toBe("2026-06-30");
  });
});

describe("reading each kind", () => {
  const ok = (kind: Parameters<typeof parsePaper>[0], can: PaperCan, raw: Record<string, string>, opts: ParseOptions = OPTS) => {
    const r = parsePaper(kind, can, raw, opts);
    if (!r.ok) throw new Error(r.error);
    return r.value;
  };
  const bad = (kind: Parameters<typeof parsePaper>[0], can: PaperCan, raw: Record<string, string>, opts: ParseOptions = OPTS) => {
    const r = parsePaper(kind, can, raw, opts);
    if (r.ok) throw new Error("expected an error");
    return r.error;
  };

  it("reads a revenue license as a renewal of its type, named by its end date", () => {
    const v = ok("license", BOTH, { provider: "Test Council", startDate: "2026-03-03", expiryDate: "2027-03-02", amount: "1,540.00" });
    expect(v).toMatchObject({ mode: "renewal", kind: "license", nameKind: "license", nameDate: "2027-03-02", renewal: { type: "Revenue license", provider: "Test Council", amount: "1540.00" } });
  });

  it("reads insurance and an emission test the same way", () => {
    expect(ok("insurance", BOTH, { provider: "Test Insurer", startDate: "2026-01-01", expiryDate: "2026-12-31", amount: "50000" })).toMatchObject({ renewal: { type: "Insurance" }, nameKind: "insurance" });
    expect(ok("emission", BOTH, { provider: "Test Centre", startDate: "2026-05-01", expiryDate: "2026-10-31" })).toMatchObject({ renewal: { type: "Emission test" }, nameKind: "emission" });
  });

  it("refuses a missing or impossible end date and an end before the start", () => {
    expect(bad("license", BOTH, { startDate: "2026-03-03" })).toMatch(/Expiry date is required/);
    expect(bad("license", BOTH, { expiryDate: "2026-02-30" })).toMatch(/valid date/);
    expect(bad("license", BOTH, { startDate: "2027-03-03", expiryDate: "2027-03-02" })).toMatch(/cannot be after/);
  });

  it("never reads a policy, license or certificate number", () => {
    const v = ok("insurance", BOTH, { provider: "Test Insurer", expiryDate: "2026-12-31", referenceNumber: "POL-123", policyNumber: "POL-123", number: "42" });
    expect(JSON.stringify(v)).not.toContain("POL-123");
    expect(Object.keys((v as { renewal: object }).renewal).sort()).toEqual(["amount", "expiryDate", "odometerKm", "provider", "startDate", "type"]);
  });

  it("keeps an emission test's odometer only for a vehicle that is not set to ignore it", () => {
    const raw = { provider: "Test Centre", startDate: "2026-05-01", expiryDate: "2026-10-31", odometerKm: "42,959" };
    expect(ok("emission", BOTH, raw)).toMatchObject({ renewal: { odometerKm: 42959 } });
    expect(ok("emission", BOTH, raw, { ...OPTS, ignoreEmissionOdometer: true })).toMatchObject({ renewal: { odometerKm: null } });
    // A stray number from a crafted request cannot make an ignoring vehicle's test fail either.
    expect(ok("emission", BOTH, { ...raw, startDate: "", odometerKm: "abc" }, { ...OPTS, ignoreEmissionOdometer: true })).toMatchObject({ renewal: { odometerKm: null } });
  });

  it("never keeps an odometer on a license or insurance", () => {
    expect(ok("license", BOTH, { expiryDate: "2027-03-02", startDate: "2026-03-03", odometerKm: "1000" })).toMatchObject({ renewal: { odometerKm: null } });
  });

  it("keeps a renewal with no start date, as the old form did", () => {
    expect(ok("license", BOTH, { expiryDate: "2027-03-02" })).toMatchObject({ renewal: { startDate: null } });
  });

  it("reads a service with the oil-change marker, from the same logic as Add a service", () => {
    const v = ok("service", BOTH, { serviceDate: "2026-06-14", serviceType: "Oil change", garage: "Test Garage", odometerKm: "31,200", cost: "6,500.00", nextDueDate: "", markerRemind: "on" });
    expect(v).toMatchObject({ mode: "service", nameKind: "service", nameDate: "2026-06-14", service: { serviceType: "Oil change", odometerKm: 31200, cost: "6500.00", nextDueDate: "2026-12-14" } });
  });

  it("leaves the marker out when the switch is off, and keeps a typed date for other types", () => {
    expect(ok("service", BOTH, { serviceDate: "2026-06-14", serviceType: "Oil change", markerRemind: "off" })).toMatchObject({ service: { nextDueDate: null } });
    expect(ok("service", BOTH, { serviceDate: "2026-06-14", serviceType: "Tyres", nextDueDate: "2027-06-14" })).toMatchObject({ service: { nextDueDate: "2027-06-14" } });
  });

  it("refuses a service with no type or a next due date before the service", () => {
    expect(bad("service", BOTH, { serviceDate: "2026-06-14", serviceType: "" })).toMatch(/Service type is required/);
    expect(bad("service", BOTH, { serviceDate: "2026-06-14", serviceType: "Tyres", nextDueDate: "2026-06-01" })).toMatch(/cannot be before/);
  });

  it("reads a registration book with its printed date optional (the day it is added when blank)", () => {
    expect(ok("book", BOTH, { date: "2017-03-01" })).toMatchObject({ mode: "document", doc: { kind: "book", date: "2017-03-01", title: "Registration book" }, nameKind: "book", nameDate: "2017-03-01" });
    expect(ok("book", BOTH, {})).toMatchObject({ doc: { date: "2026-11-24" }, nameDate: "2026-11-24" });
    expect(bad("book", BOTH, { date: "2017-02-30" })).toMatch(/Give the document/);
  });

  it("reads Other with its title and date; the words become its type", () => {
    const v = ok("other", BOTH, { title: "TEST upload", date: "2000-01-01" });
    expect(v).toMatchObject({ doc: { kind: "other", title: "TEST upload", date: "2000-01-01" }, nameKind: "test-upload", nameDate: "2000-01-01" });
    expect(paperFileName(v, "TST-1234", "application/pdf")).toBe("TST-1234_test-upload_2000-01-01.pdf");
    expect(bad("other", BOTH, { date: "2000-01-01" })).toMatch(/Say what/);
    expect(bad("other", BOTH, { title: "x".repeat(101), date: "2000-01-01" })).toMatch(/at most 100/);
    expect(bad("other", BOTH, { title: "Thing" })).toMatch(/Give the document/);
  });

  it("keeps a document titled like a kind from being read back as that kind", () => {
    expect(ok("other", BOTH, { title: "Insurance", date: "2026-01-01" })).toMatchObject({ nameKind: "other-insurance" });
  });

  it("saves a person with only documents as an on-file document of that kind, dated by its end, with no record", () => {
    const v = ok("license", DOCS, { expiryDate: "2027-03-02", provider: "Ignored", amount: "999" });
    expect(v).toEqual({ mode: "document", doc: { kind: "license", date: "2027-03-02", title: "Revenue license until 2027-03-02" }, nameKind: "license", nameDate: "2027-03-02" });
    expect(ok("service", DOCS, { serviceDate: "2026-06-14", serviceType: "ignored" })).toMatchObject({ mode: "document", doc: { kind: "other", title: "Service invoice", date: "2026-06-14" }, nameKind: "service-invoice" });
    expect(bad("license", DOCS, { startDate: "2026-03-03" })).toMatch(/Give the document/);
  });

  it("refuses a person who can do neither, and a book or other for a person with only records", () => {
    expect(bad("license", NEITHER, { expiryDate: "2027-03-02" })).toMatch(/cannot/);
    expect(bad("book", RECORDS, {})).toMatch(/cannot/);
  });
});

describe("the words", () => {
  it("names a file from the plate, what it is and its date; a clash gets _2", () => {
    const parsed = parsePaper("license", BOTH, { expiryDate: "2027-03-02" }, OPTS);
    if (!parsed.ok) throw new Error("x");
    expect(paperFileName(parsed.value, "TST-1234", "application/pdf")).toBe("TST-1234_license_2027-03-02.pdf");
    expect(paperFileName(parsed.value, "TST-1234", "image/jpeg", ["TST-1234_license_2027-03-02.jpg"])).toBe("TST-1234_license_2027-03-02_2.jpg");
  });

  it("says which paper is already saved", () => {
    expect(twinMessage("license", "4 Oct 2026", true)).toBe("A license ending 4 Oct 2026 is already saved with its scan.");
    expect(twinMessage("insurance", "4 Oct 2026", false)).toBe("An insurance ending 4 Oct 2026 is already saved, without its scan.");
  });

  it("lists only what saving really does for this person", () => {
    expect(savingLines("license", BOTH, { hasFile: true, hasPrevious: true })).toEqual([
      "The license record is made, with this file on it",
      "The last license is marked renewed",
      "Reminders and notices follow the new end date",
      "It shows in Documents and on the timeline",
    ]);
    expect(savingLines("license", RECORDS, { hasFile: true })).toEqual(["The license record is made, with no scan yet", "Reminders and notices follow the new end date"]);
    expect(savingLines("license", DOCS, { hasFile: true })).toEqual(["The file is kept with the vehicle's papers, as a paper on file", "It shows under Documents"]);
    expect(savingLines("service", BOTH, { hasFile: true, hasOdometer: true, markerDateText: "14 Dec" })).toEqual([
      "The service is recorded, with the invoice on it",
      "The odometer reading joins the timeline",
      "The oil-change reminder is set for 14 Dec",
    ]);
  });
});
