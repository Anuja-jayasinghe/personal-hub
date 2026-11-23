import { describe, expect, it } from "vitest";
import { defaultDocTitle, docFileName, documentKind, extensionFor, parseDocUpload, renewalKind, replacementName, vehiclePart } from "./doc-names";

describe("vehiclePart", () => {
  it("uses the plate without its province", () => {
    expect(vehiclePart({ registrationNumber: "BAA-5678", nickname: "Bike" })).toBe("BAA-5678");
    expect(vehiclePart({ registrationNumber: "WP CAB-1234", nickname: "Car" })).toBe("CAB-1234");
    expect(vehiclePart({ registrationNumber: "wp cab 1234", nickname: "Car" })).toBe("CAB-1234");
  });

  it("falls back to the nickname when there is no plate", () => {
    expect(vehiclePart({ registrationNumber: null, nickname: "Family car" })).toBe("FAMILY-CAR");
    expect(vehiclePart({ registrationNumber: "", nickname: "!!" })).toBe("VEHICLE");
  });
});

describe("kinds", () => {
  it("maps the renewal types to their short names", () => {
    expect(renewalKind("Revenue license")).toBe("license");
    expect(renewalKind("Emission test")).toBe("emission");
    expect(renewalKind("Insurance")).toBe("insurance");
    expect(renewalKind("Fitness certificate")).toBe("fitness-certificate");
  });

  it("names an Other document after its title", () => {
    expect(documentKind("book", "anything")).toBe("book");
    expect(documentKind("other", "Service invoice #12")).toBe("service-invoice-12");
    expect(documentKind("other", "  ")).toBe("other");
  });
  it("never names an Other paper like a kind", () => {
    expect(documentKind("other", "Insurance")).toBe("other-insurance");
    expect(documentKind("other", "book")).toBe("other-book");
    expect(documentKind("other", "Other")).toBe("other");
  });
});

describe("docFileName", () => {
  const parts = { vehicle: "BAA-5678", kind: "license", date: "2027-09-23", ext: "pdf" };

  it("builds PLATE_type_date.ext", () => {
    expect(docFileName(parts)).toBe("BAA-5678_license_2027-09-23.pdf");
  });

  it("adds _2, _3 when the record already has that name", () => {
    expect(docFileName(parts, ["BAA-5678_license_2027-09-23.pdf"])).toBe("BAA-5678_license_2027-09-23_2.pdf");
    expect(docFileName(parts, ["baa-5678_license_2027-09-23.PDF", "BAA-5678_license_2027-09-23_2.pdf"])).toBe("BAA-5678_license_2027-09-23_3.pdf");
    expect(docFileName({ ...parts, ext: "jpg" }, ["BAA-5678_license_2027-09-23.pdf"])).toBe("BAA-5678_license_2027-09-23.jpg");
  });

  it("never takes the extension from a name, only from the checked type", () => {
    expect(extensionFor("application/pdf")).toBe("pdf");
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("text/html")).toBe("bin");
  });
});

describe("replacementName", () => {
  it("keeps the replaced file's name with the new extension", () => {
    expect(replacementName("CAB-1234_insurance_2027-05-01.pdf", "jpg", [])).toBe("CAB-1234_insurance_2027-05-01.jpg");
    expect(replacementName("CAB-1234_license_2027-02-12_2.jpg", "jpg", [])).toBe("CAB-1234_license_2027-02-12.jpg");
  });

  it("stays unique among the record's other files", () => {
    expect(replacementName("CAB-1234_license_2027-02-12_2.jpg", "jpg", ["CAB-1234_license_2027-02-12.jpg"])).toBe("CAB-1234_license_2027-02-12_2.jpg");
  });

  it("keeps an older, non-hub name as it was", () => {
    expect(replacementName("IMG_2041.jpg", "pdf", [])).toBe("IMG_2041.pdf");
  });
});

describe("defaultDocTitle", () => {
  it("makes a title from the kind and date", () => {
    expect(defaultDocTitle("book", "2018-06-26")).toBe("Registration book");
    expect(defaultDocTitle("insurance", "2027-05-01")).toBe("Insurance until 2027-05-01");
  });
});

describe("parseDocUpload", () => {
  it("needs a kind and a real date, and makes a title when none is typed", () => {
    expect(parseDocUpload({ kind: "book", date: "2018-06-26", title: "" }, 100)).toEqual({ ok: true, value: { kind: "book", date: "2018-06-26", title: "Registration book" } });
    expect(parseDocUpload({ kind: "x", date: "2018-06-26" }, 100)).toMatchObject({ ok: false });
    expect(parseDocUpload({ kind: "license", date: "2027-02-30" }, 100)).toMatchObject({ ok: false });
    expect(parseDocUpload({ kind: "license", date: "" }, 100)).toMatchObject({ ok: false });
  });

  it("needs a title for Other", () => {
    expect(parseDocUpload({ kind: "other", date: "2026-05-01", title: " " }, 100)).toMatchObject({ ok: false });
    expect(parseDocUpload({ kind: "other", date: "2026-05-01", title: "Service invoice" }, 100)).toMatchObject({ ok: true, value: { title: "Service invoice" } });
  });
});
