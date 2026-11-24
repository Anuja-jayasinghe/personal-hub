import { describe, expect, it } from "vitest";
import { accessFromGrants } from "@/features/people/access";
import { paperContext } from "./paper-context";
import { previewName, saveLabel } from "./paper-flow";

/** What the sheet is handed for one vehicle and one person (V.1b, C148). Everything is made up. */
const vehicle = { id: "11111111-1111-4111-8111-111111111111", nickname: "Test bike", registrationNumber: "WP TST-1234", ignoreEmissionOdometer: false };
const oil = { oilChangeMonths: 6, oilChangeKm: 2500, oilChangeTypes: ["Oil change"] };
const grants = (...g: [string, string][]) => accessFromGrants(g.map(([area, level]) => ({ area, level })));
const make = (access: Parameters<typeof paperContext>[0]["access"], over: Partial<typeof vehicle> = {}) =>
  paperContext({ vehicle: { ...vehicle, ...over }, access, today: "2026-11-24", oil, renewals: [{ type: "Insurance", provider: "Test Insurer", startDate: "2026-01-01", expiryDate: "2026-12-31" }] });

describe("paperContext", () => {
  it("works out what the person may do from their access: records need Vehicles Add, files need Vehicle documents Add", () => {
    expect(make({ owner: true }).can).toEqual({ records: true, files: true });
    expect(make(grants(["vehicles", "add"], ["vehicle_documents", "see"])).can).toEqual({ records: true, files: false });
    expect(make(grants(["vehicles", "see"], ["vehicle_documents", "add"])).can).toEqual({ records: false, files: true });
    expect(make(grants(["vehicles", "edit"], ["vehicle_documents", "edit"])).can).toEqual({ records: true, files: true });
    expect(make(grants(["vehicles", "see"], ["vehicle_documents", "see"])).can).toEqual({ records: false, files: false });
  });

  it("carries the plate part of file names, the types, and the prefill of the last record of each kind", () => {
    const ctx = make({ owner: true });
    expect(ctx.namePrefix).toBe("TST-1234");
    expect(ctx.renewalTypes).toEqual(["Revenue license", "Insurance", "Emission test"]);
    expect(ctx.prefill.insurance).toEqual({ provider: "Test Insurer", lastExpiry: "2026-12-31", spanMonths: 12 });
    expect(ctx.prefill.license.provider).toBeNull();
  });

  it("asks for an emission odometer only for a vehicle that is not set to ignore it", () => {
    expect(make({ owner: true }).askOdometer).toBe(true);
    expect(make({ owner: true }, { ignoreEmissionOdometer: true }).askOdometer).toBe(false);
  });
});

describe("the sheet's name preview and button", () => {
  const BOTH = { records: true, files: true };
  it("shows the name once its date is a real day, and is the same name the server gives", () => {
    expect(previewName("license", BOTH, { expiryDate: "" }, "TST-1234", "application/pdf", "2026-11-24")).toBeNull();
    expect(previewName("license", BOTH, { expiryDate: "2027-03-02" }, "TST-1234", "application/pdf", "2026-11-24")).toBe("TST-1234_license_2027-03-02.pdf");
    expect(previewName("service", BOTH, { serviceDate: "2026-06-14" }, "TST-1234", "image/jpeg", "2026-11-24")).toBe("TST-1234_service_2026-06-14.jpg");
    expect(previewName("service", { records: false, files: true }, { serviceDate: "2026-06-14" }, "TST-1234", "application/pdf", "2026-11-24")).toBe("TST-1234_service-invoice_2026-06-14.pdf");
    expect(previewName("book", BOTH, {}, "TST-1234", "application/pdf", "2026-11-24")).toBe("TST-1234_book_2026-11-24.pdf");
    expect(previewName("book", BOTH, { date: "2017-02-30" }, "TST-1234", "application/pdf", "2026-11-24")).toBeNull();
    expect(previewName("other", BOTH, { title: "", date: "2000-01-01" }, "TST-1234", "application/pdf", "2026-11-24")).toBeNull();
    expect(previewName("other", BOTH, { title: "TEST upload", date: "2000-01-01" }, "TST-1234", "application/pdf", "2026-11-24")).toBe("TST-1234_test-upload_2000-01-01.pdf");
    expect(previewName("license", { records: false, files: false }, { expiryDate: "2027-03-02" }, "TST-1234", "application/pdf", "2026-11-24")).toBeNull();
  });

  it("words the Save button after what is saved, and says why when nothing is chosen", () => {
    expect(saveLabel("license")).toBe("Save the license");
    expect(saveLabel("service")).toBe("Save the service");
    expect(saveLabel("other")).toBe("Save the paper");
    expect(saveLabel(null)).toBe("Choose what it is");
  });
});
