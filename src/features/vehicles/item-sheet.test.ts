import { describe, expect, it } from "vitest";
import { accessFromGrants } from "@/features/people/access";
import { addDays } from "@/lib/dates";
import { renewalSheet, serviceSheet, type SheetFile } from "./item-sheet";
import { oilState, sheetAccess, type OverviewRenewal, type OverviewService } from "./overview";

/** The detail sheets' access rules and facts, with made-up rows only. */
const TODAY = "2026-11-24";
const V = "00000000-0000-4000-8000-0000000000a1";
const rules = { oilChangeMonths: 6, oilChangeKm: 2500, oilChangeTypes: ["Oil change", "Full service"] };
const person = (...g: [string, string][]) => accessFromGrants(g.map(([area, level]) => ({ area, level })));
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let n = 500;

const renewal = (type: string, expiresIn: number, over: Partial<OverviewRenewal> = {}): OverviewRenewal => ({
  id: uuid(++n),
  vehicleId: V,
  type,
  provider: null,
  startDate: addDays(TODAY, expiresIn - 365),
  expiryDate: addDays(TODAY, expiresIn),
  amount: null,
  renewedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
});
const service = (serviceType: string, ago: number, over: Partial<OverviewService> = {}): OverviewService => ({
  id: uuid(++n),
  vehicleId: V,
  serviceDate: addDays(TODAY, -ago),
  serviceType,
  garage: null,
  odometerKm: null,
  cost: null,
  nextDueDate: null,
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, n % 60)),
  ...over,
});
const file = (ownerId: string, name = "TEST-1_license_2027-01-01.pdf"): SheetFile => ({ id: uuid(++n), ownerType: "vehicle_renewal", ownerId, fileName: name, title: null, mimeType: "application/pdf", sizeBytes: 1000, createdAt: new Date("2026-02-01T00:00:00Z") });

describe("a renewal's sheet", () => {
  const build = (access: ReturnType<typeof sheetAccess>, o: { sample?: boolean; withFile?: boolean; expiresIn?: number } = {}) => {
    const r = renewal("Revenue license", o.expiresIn ?? 100);
    const old = renewal("Revenue license", -265, { renewedAt: new Date("2026-01-01T00:00:00Z") });
    const older = renewal("Revenue license", -630, { renewedAt: new Date("2025-01-01T00:00:00Z") });
    const other = renewal("Insurance", -265);
    const files = o.withFile === false ? [] : [file(r.id)];
    return { r, old, older, model: renewalSheet({ renewal: r, renewals: [r, old, older, other], files, today: TODAY, access, sample: o.sample ?? false }) };
  };

  it("an owner sees the file tile and may do everything", () => {
    const { model } = build(sheetAccess({ owner: true }));
    expect(model.isCurrent).toBe(true);
    expect(model.files).toHaveLength(1);
    expect(model.can).toMatchObject({ edit: true, delete: true, download: true, replace: true, addScan: false, renew: false });
  });
  it("a person who only sees Vehicles gets a read-only sheet with no file at all", () => {
    const { model } = build(sheetAccess(person(["vehicles", "see"])));
    expect(model.files).toBeNull(); // no tile, no name, even though the loader had one
    expect(model.can).toEqual({ edit: false, delete: false, renew: false, addScan: false, download: false, replace: false });
  });
  it("without Vehicle documents no file shows even for someone who may edit Vehicles", () => {
    const { model } = build(sheetAccess(person(["vehicles", "edit"])), { expiresIn: 10 });
    expect(model.files).toBeNull();
    expect(model.can).toMatchObject({ edit: true, renew: true, download: false, replace: false, addScan: false });
  });
  it("with Vehicle documents See the file shows, read-only", () => {
    const { model } = build(sheetAccess(person(["vehicles", "see"], ["vehicle_documents", "see"])));
    expect(model.files).toHaveLength(1);
    expect(model.can).toMatchObject({ download: true, replace: false, addScan: false, edit: false });
  });
  it("no scan yet: Add the scan only for someone who may add files", () => {
    expect(build(sheetAccess(person(["vehicles", "see"], ["vehicle_documents", "see"])), { withFile: false }).model.can.addScan).toBe(false);
    const adder = build(sheetAccess(person(["vehicles", "see"], ["vehicle_documents", "add"])), { withFile: false }).model;
    expect(adder.files).toEqual([]);
    expect(adder.can).toMatchObject({ addScan: true, download: false });
  });
  it("Renew shows only inside the window (or late), for the current record, for an editor", () => {
    const edit = sheetAccess({ owner: true });
    expect(build(edit, { expiresIn: 31 }).model.can.renew).toBe(false);
    expect(build(edit, { expiresIn: 30 }).model.can.renew).toBe(true);
    expect(build(edit, { expiresIn: -4 }).model.can.renew).toBe(true);
    expect(build(sheetAccess(person(["vehicles", "add"])), { expiresIn: 5 }).model.can.renew).toBe(false);
    // an earlier record never offers Renew
    const { old, r, older } = build(edit);
    const model = renewalSheet({ renewal: old, renewals: [r, old, older], files: [], today: TODAY, access: edit, sample: false });
    expect(model.isCurrent).toBe(false);
    expect(model.can.renew).toBe(false);
  });
  it("lists the earlier records of the same type only, newest first", () => {
    const { model, old, older } = build(sheetAccess({ owner: true }));
    expect(model.earlier.map((e) => e.id)).toEqual([old.id, older.id]);
  });
  it("the demo shows its sample file but offers no download, replace or upload", () => {
    const { model } = build(sheetAccess({ owner: true }), { sample: true });
    expect(model.files).toHaveLength(1);
    expect(model.can).toMatchObject({ download: false, replace: false, addScan: false });
  });
});

describe("a service's sheet", () => {
  const oilOf = (services: OverviewService[]) => oilState(services, rules, TODAY, []);

  it("the newest oil change carries the amber marker card with days and km", () => {
    const s = service("Oil change", 160, { nextDueDate: addDays(TODAY, 20) });
    const model = serviceSheet({ service: s, services: [s], oil: oilOf([s]), rules, files: [], today: TODAY, access: sheetAccess({ owner: true }), sample: false });
    expect(model.oil).toMatchObject({ current: true, days: 20, tone: "soon", markerDate: s.nextDueDate });
    expect(model.nextDue).toBeNull();
  });
  it("an older oil change is replaced by the newer one and shows no days", () => {
    const old = service("Oil change", 300, { nextDueDate: addDays(TODAY, -100) });
    const newer = service("Full service", 10, { nextDueDate: addDays(TODAY, 170) });
    const model = serviceSheet({ service: old, services: [old, newer], oil: oilOf([old, newer]), rules, files: [], today: TODAY, access: sheetAccess({ owner: true }), sample: false });
    expect(model.oil).toMatchObject({ current: false, days: null, tone: null, km: null });
  });
  it("another type has no amber card, but its next due date shows", () => {
    const t = service("Tyres", 50, { nextDueDate: addDays(TODAY, 9) });
    const model = serviceSheet({ service: t, services: [t], oil: oilOf([t]), rules, files: [], today: TODAY, access: sheetAccess({ owner: true }), sample: false });
    expect(model.oil).toBeNull();
    expect(model.nextDue).toEqual({ date: t.nextDueDate, days: 9, reminds: true });
  });
  it("its files follow Vehicle documents, not Vehicles", () => {
    const s = service("Oil change", 10);
    const f = file(s.id, "TEST-1_service_2026-11-14.pdf");
    const run = (access: ReturnType<typeof sheetAccess>, sample = false) => serviceSheet({ service: s, services: [s], oil: oilOf([s]), rules, files: [f], today: TODAY, access, sample });
    expect(run(sheetAccess(person(["vehicles", "see"]))).files).toBeNull();
    expect(run(sheetAccess(person(["vehicles", "see"], ["vehicle_documents", "see"]))).files).toHaveLength(1);
    expect(run(sheetAccess(person(["vehicles", "see"], ["vehicle_documents", "see"]))).can).toEqual({ edit: false, delete: false, addInvoice: false, deleteFile: false, manageFiles: false, download: true });
    expect(run(sheetAccess(person(["vehicles", "see"]))).can).toMatchObject({ download: false });
    expect(run(sheetAccess({ owner: true })).can).toEqual({ edit: true, delete: true, addInvoice: false, deleteFile: true, manageFiles: true, download: true });
    expect(run(sheetAccess({ owner: true }), true).can).toMatchObject({ deleteFile: false, manageFiles: false, download: false });
  });
  it("\"Manage files\" (add another, delete any) shows for a service that has files, for someone who may add or delete them (V.3, C150)", () => {
    const s = service("Tyres", 10);
    const f = file(s.id, "TEST-1_service_2026-11-14.pdf");
    const run = (access: ReturnType<typeof sheetAccess>, files = [f]) => serviceSheet({ service: s, services: [s], oil: oilOf([s]), rules, files, today: TODAY, access, sample: false }).can.manageFiles;
    expect(run(sheetAccess(person(["vehicles", "see"], ["vehicle_documents", "add"])))).toBe(true);
    expect(run(sheetAccess(person(["vehicles", "see"], ["vehicle_documents", "edit"])))).toBe(true);
    expect(run(sheetAccess(person(["vehicles", "edit"], ["vehicle_documents", "see"])))).toBe(false);
    expect(run(sheetAccess(person(["vehicles", "edit"])))).toBe(false);
    expect(run(sheetAccess({ owner: true }), [])).toBe(false);
  });
  it("Add the invoice shows for a service with no file, only for someone who may add files", () => {
    const s = service("Tyres", 10);
    const run = (access: ReturnType<typeof sheetAccess>) => serviceSheet({ service: s, services: [s], oil: oilOf([s]), rules, files: [], today: TODAY, access, sample: false }).can.addInvoice;
    expect(run(sheetAccess(person(["vehicles", "see"], ["vehicle_documents", "add"])))).toBe(true);
    expect(run(sheetAccess(person(["vehicles", "edit"], ["vehicle_documents", "see"])))).toBe(false);
    expect(run(sheetAccess(person(["vehicles", "edit"])))).toBe(false);
  });
});
