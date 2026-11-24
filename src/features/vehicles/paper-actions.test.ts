import { and, asc, eq, sql } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/read";
import { accessGrants, attachments, people, vehicleRenewals, vehicleServices, vehicles } from "@/db/schema";
import { makeTestDb } from "@/test/pglite";
import type { PaperInput } from "./paper-flow";

/**
 * The one flow for adding a paper (V.1b, C148), end to end through the REAL `requireUser`, `getAuthState`, validators
 * and a real Postgres (PGlite): only Clerk's session and private storage are fakes. What is tested: that the paper
 * makes its record and its file together or not at all (a failing storage step and a failing database step leave
 * no row and no object), what each combination of access can do and that a person cannot do more by crafting the
 * request, that a record is never made twice, and that the history of a kind stays right. Everything is made up.
 */
const h = vi.hoisted(() => ({
  db: null as unknown as Db,
  userId: null as string | null,
  email: "" as string,
  /** The fake bucket: what is stored, by path. */
  objects: new Map<string, { size: number; contentType: string }>(),
  removed: [] as string[],
  signed: [] as string[],
  infoError: false,
  removeError: false,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: () => {} }));
vi.mock("next/server", () => ({ connection: async () => {}, after: () => {} }));
vi.mock("@/db", () => ({
  get db() {
    return h.db;
  },
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: h.userId, sessionClaims: { email: h.email } }),
  currentUser: async () => null,
}));
vi.mock("@/lib/storage", () => ({
  ATTACHMENT_BUCKET: "attachments",
  MAX_ATTACHMENT_BYTES: 10 * 1024 * 1024,
  ALLOWED_ATTACHMENT_TYPES: ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"],
  COVER_TYPES: ["image/jpeg", "image/png", "image/webp"],
  COVER_TYPE_MESSAGE: "",
  storageClient: () => ({
    storage: {
      from: () => ({
        createSignedUploadUrl: async (path: string) => {
          h.signed.push(path);
          return { data: { path, signedUrl: `https://storage.test/${path}` }, error: null };
        },
        info: async (path: string) => {
          if (h.infoError) return { data: null, error: { message: "storage is down" } };
          const object = h.objects.get(path);
          return object ? { data: { size: object.size, contentType: object.contentType }, error: null } : { data: null, error: { message: "not found" } };
        },
        remove: async (paths: string[]) => {
          if (h.removeError) return { error: { message: "cannot remove" } };
          for (const p of paths) h.objects.delete(p);
          h.removed.push(...paths);
          return { error: null };
        },
      }),
    },
  }),
}));

const { preparePaper, savePaper } = await import("./paper-actions");

const OWNER = "owner@example.com";
const DOCS_ONLY = "docs@example.com";
const RECORDS_ONLY = "records@example.com";
const BOTH = "both@example.com";
const NEITHER = "nobody@example.com";

let car: { id: string };
let otherCar: { id: string };

const signIn = (email: string) => {
  h.userId = `user_${email}`;
  h.email = email;
};
async function addPerson(email: string, grants: [string, "see" | "add" | "edit"][]) {
  const [p] = await h.db.insert(people).values({ email, status: "active" }).returning();
  for (const [area, level] of grants) await h.db.insert(accessGrants).values({ personId: p.id, area, level });
}

const renewals = (vehicleId = car.id) => h.db.select().from(vehicleRenewals).where(eq(vehicleRenewals.vehicleId, vehicleId)).orderBy(asc(vehicleRenewals.expiryDate));
const files = () => h.db.select().from(attachments).orderBy(asc(attachments.createdAt));
const services = () => h.db.select().from(vehicleServices);
/** Everything a save may write, so "nothing left behind" is one comparison. */
const snapshot = async () => ({
  renewals: await h.db.select().from(vehicleRenewals),
  services: await services(),
  files: await files(),
  objects: [...h.objects.keys()].sort(),
});

const PDF = { fileName: "IMG_0001.pdf", mimeType: "application/pdf", size: 1000 };
const license = (over: Record<string, string> = {}): Pick<PaperInput, "kind" | "fields"> => ({
  kind: "license",
  fields: { provider: "Test Council", startDate: "2027-03-03", expiryDate: "2028-03-02", amount: "", ...over },
});

/** What the browser does: prepare, put the file in the bucket, then save. */
async function add(
  input: Pick<PaperInput, "kind" | "fields"> & { vehicleId?: string; attach?: boolean },
  options: { file?: boolean; size?: number; contentType?: string } = {},
) {
  const base: PaperInput = { vehicleId: car.id, ...input };
  if (options.file === false) return { prepared: null, saved: await savePaper(base) };
  const file = { ...PDF, size: options.size ?? PDF.size, mimeType: options.contentType ?? PDF.mimeType };
  const prepared = await preparePaper({ ...base, file });
  if (!prepared.ok) return { prepared, saved: null };
  h.objects.set(prepared.path, { size: options.size ?? PDF.size, contentType: options.contentType ?? PDF.mimeType });
  return { prepared, saved: await savePaper({ ...base, upload: { path: prepared.path, ownerId: prepared.ownerId } }) };
}

beforeAll(async () => {
  ({ db: h.db } = await makeTestDb());
}, 60_000);

beforeEach(async () => {
  // One migrated database for the file, emptied between tests (building it takes most of a second).
  await h.db.execute(sql`truncate table vehicles, people, attachments, vehicle_renewals, vehicle_services restart identity cascade`);
  h.objects.clear();
  h.removed = [];
  h.signed = [];
  h.infoError = false;
  h.removeError = false;
  vi.stubEnv("ALLOWED_EMAILS", OWNER);
  vi.spyOn(console, "error").mockImplementation(() => {});
  [car, otherCar] = await h.db
    .insert(vehicles)
    .values([
      { nickname: "Test car", registrationNumber: "WP TST-1234" },
      { nickname: "Other car", registrationNumber: "WP TST-5678" },
    ])
    .returning({ id: vehicles.id });
  await addPerson(DOCS_ONLY, [["vehicles", "see"], ["vehicle_documents", "add"]]);
  await addPerson(RECORDS_ONLY, [["vehicles", "add"], ["vehicle_documents", "see"]]);
  await addPerson(BOTH, [["vehicles", "add"], ["vehicle_documents", "add"]]);
  await addPerson(NEITHER, [["vehicles", "see"], ["vehicle_documents", "see"]]);
  signIn(OWNER);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("a license makes its record and puts its file on it", () => {
  it("saves the record, the file under that record's folder, with the name the hub gives it", async () => {
    const { prepared, saved } = await add(license());
    expect(saved).toEqual({ ok: true });
    const [r] = await renewals();
    expect(r).toMatchObject({ type: "Revenue license", provider: "Test Council", startDate: "2027-03-03", expiryDate: "2028-03-02", renewedAt: null });
    expect(prepared?.ok && prepared.ownerId).toBe(r.id);
    const [f] = await files();
    expect(f).toMatchObject({ ownerType: "vehicle_renewal", ownerId: r.id, fileName: "TST-1234_license_2028-03-02.pdf", mimeType: "application/pdf", sizeBytes: 1000, title: null });
    expect(f.storagePath.startsWith(`vehicle_renewal/${r.id}/`)).toBe(true);
    expect(h.objects.has(f.storagePath)).toBe(true);
  });

  it("only picks an id and a link when preparing: no row is written", async () => {
    const before = await snapshot();
    const prepared = await preparePaper({ vehicleId: car.id, ...license(), file: PDF });
    expect(prepared).toMatchObject({ ok: true });
    expect(await snapshot()).toEqual(before);
    expect(h.signed).toHaveLength(1);
  });

  it("marks the license it replaces as renewed from the new start day, as Renew does", async () => {
    const [old] = await h.db.insert(vehicleRenewals).values({ vehicleId: car.id, type: "Revenue license", startDate: "2026-03-03", expiryDate: "2027-03-02" }).returning();
    expect((await add(license())).saved).toEqual({ ok: true });
    const rows = await renewals();
    expect(rows.map((r) => [r.id === old.id, r.expiryDate, r.renewedAt?.toISOString() ?? null])).toEqual([
      [true, "2027-03-02", "2027-03-03T09:00:00.000Z"],
      [false, "2028-03-02", null],
    ]);
  });

  it("with no start date renews the old one 'now' (the existing behaviour)", async () => {
    await h.db.insert(vehicleRenewals).values({ vehicleId: car.id, type: "Revenue license", expiryDate: "2027-03-02" });
    const before = Date.now();
    expect((await add(license({ startDate: "" }))).saved).toEqual({ ok: true });
    const [old, fresh] = await renewals();
    expect(old.renewedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(fresh).toMatchObject({ startDate: null, renewedAt: null });
  });

  it("leaves other kinds and other vehicles alone", async () => {
    await h.db.insert(vehicleRenewals).values([
      { vehicleId: car.id, type: "Insurance", expiryDate: "2027-03-02" },
      { vehicleId: otherCar.id, type: "Revenue license", expiryDate: "2027-03-02" },
    ]);
    await add(license());
    const all = await h.db.select().from(vehicleRenewals);
    expect(all.filter((r) => r.renewedAt !== null)).toEqual([]);
  });

  it("an older paper being added is stored already renewed, from the start of the next later record", async () => {
    await h.db.insert(vehicleRenewals).values({ vehicleId: car.id, type: "Revenue license", startDate: "2027-03-03", expiryDate: "2028-03-02" });
    const { saved } = await add(license({ startDate: "2025-03-03", expiryDate: "2026-03-02" }));
    expect(saved).toEqual({ ok: true });
    const rows = await renewals();
    expect(rows.map((r) => [r.expiryDate, r.renewedAt?.toISOString() ?? null])).toEqual([
      ["2026-03-02", "2027-03-03T09:00:00.000Z"],
      ["2028-03-02", null],
    ]);
    // The current license is untouched.
    expect(rows[1].renewedAt).toBeNull();
  });

  it("keeps an older paper's days when the next later record has no start: renewed now", async () => {
    await h.db.insert(vehicleRenewals).values({ vehicleId: car.id, type: "Revenue license", expiryDate: "2028-03-02" });
    await add(license({ startDate: "", expiryDate: "2026-03-02" }));
    const [history] = await renewals();
    expect(history.expiryDate).toBe("2026-03-02");
    expect(history.renewedAt).not.toBeNull();
  });
});

describe("the other kinds", () => {
  it("insurance and an emission test make their own records and files", async () => {
    expect((await add({ kind: "insurance", fields: { provider: "Test Insurer", startDate: "2026-01-01", expiryDate: "2026-12-31", amount: "50,000" } })).saved).toEqual({ ok: true });
    expect((await add({ kind: "emission", fields: { provider: "Test Centre", startDate: "2026-05-01", expiryDate: "2026-10-31", odometerKm: "42,959" } })).saved).toEqual({ ok: true });
    const rows = await renewals();
    expect(rows.map((r) => [r.type, r.provider, r.amount, r.odometerKm])).toEqual([
      ["Emission test", "Test Centre", null, 42959],
      ["Insurance", "Test Insurer", "50000.00", null],
    ]);
    expect((await files()).map((f) => f.fileName)).toEqual(["TST-1234_insurance_2026-12-31.pdf", "TST-1234_emission_2026-10-31.pdf"]);
  });

  it("an emission test's odometer is dropped for a vehicle set to ignore it, and nothing fails", async () => {
    await h.db.update(vehicles).set({ ignoreEmissionOdometer: true }).where(eq(vehicles.id, car.id));
    expect((await add({ kind: "emission", fields: { startDate: "2026-05-01", expiryDate: "2026-10-31", odometerKm: "42959" } })).saved).toEqual({ ok: true });
    expect((await renewals())[0].odometerKm).toBeNull();
  });

  it("never stores a policy, license or certificate number, even when one is sent", async () => {
    await add({ kind: "insurance", fields: { provider: "Test Insurer", expiryDate: "2026-12-31", referenceNumber: "POL-9999", policyNumber: "POL-9999" } });
    expect((await renewals())[0].referenceNumber).toBeNull();
  });

  it("a service invoice makes the service with the oil-change marker, and the invoice is its file", async () => {
    const { saved } = await add({ kind: "service", fields: { serviceDate: "2026-06-14", serviceType: "Oil change", garage: "Test Garage", odometerKm: "31,200", cost: "6,500", nextDueDate: "", markerRemind: "on" } });
    expect(saved).toEqual({ ok: true });
    const [s] = await services();
    expect(s).toMatchObject({ vehicleId: car.id, serviceType: "Oil change", garage: "Test Garage", odometerKm: 31200, cost: "6500.00", nextDueDate: "2026-12-14" });
    const [f] = await files();
    expect(f).toMatchObject({ ownerType: "vehicle_service", ownerId: s.id, fileName: "TST-1234_service_2026-06-14.pdf" });
    expect(f.storagePath.startsWith(`vehicle_service/${s.id}/`)).toBe(true);
  });

  it("a service with the reminder switched off has no next due date", async () => {
    await add({ kind: "service", fields: { serviceDate: "2026-06-14", serviceType: "Oil change", markerRemind: "off" } });
    expect((await services())[0].nextDueDate).toBeNull();
  });

  it("a registration book and an Other paper are kept as documents of the vehicle, with no record", async () => {
    expect((await add({ kind: "book", fields: { date: "2017-03-01" } })).saved).toEqual({ ok: true });
    expect((await add({ kind: "other", fields: { title: "TEST upload", date: "2000-01-01" } })).saved).toEqual({ ok: true });
    expect(await renewals()).toEqual([]);
    expect(await services()).toEqual([]);
    expect((await files()).map((f) => [f.ownerType, f.ownerId === car.id, f.fileName, f.title])).toEqual([
      ["vehicle", true, "TST-1234_book_2017-03-01.pdf", "Registration book"],
      ["vehicle", true, "TST-1234_test-upload_2000-01-01.pdf", "TEST upload"],
    ]);
  });

  it("a second file of the same name gets _2, _3", async () => {
    await add({ kind: "other", fields: { title: "Thing", date: "2000-01-01" } });
    await add({ kind: "other", fields: { title: "Thing", date: "2000-01-01" } });
    await add({ kind: "other", fields: { title: "Thing", date: "2000-01-01" } });
    expect((await files()).map((f) => f.fileName)).toEqual(["TST-1234_thing_2000-01-01.pdf", "TST-1234_thing_2000-01-01_2.pdf", "TST-1234_thing_2000-01-01_3.pdf"]);
  });

  it("names the file after the checked type, not the uploader's", async () => {
    await add({ kind: "other", fields: { title: "Thing", date: "2000-01-01" } }, { contentType: "image/jpeg" });
    expect((await files())[0].fileName).toBe("TST-1234_thing_2000-01-01.jpg");
  });

  it("a vehicle with no plate is named by its nickname", async () => {
    await h.db.update(vehicles).set({ registrationNumber: null }).where(eq(vehicles.id, car.id));
    await add({ kind: "other", fields: { title: "Thing", date: "2000-01-01" } });
    expect((await files())[0].fileName).toBe("TEST-CAR_thing_2000-01-01.pdf");
  });
});

describe("the record without a file", () => {
  it("is saved with no scan yet", async () => {
    expect((await add(license(), { file: false })).saved).toEqual({ ok: true });
    expect(await renewals()).toHaveLength(1);
    expect(await files()).toEqual([]);
  });

  it("a book or Other needs a file: nothing would be saved", async () => {
    expect((await add({ kind: "book", fields: {} }, { file: false })).saved).toEqual({ ok: false, error: "Choose a file to add." });
    expect(await snapshot()).toMatchObject({ files: [], renewals: [] });
  });
});

describe("it is all or nothing", () => {
  it("a failing storage step creates nothing: the file never arrived", async () => {
    const before = await snapshot();
    const prepared = await preparePaper({ vehicleId: car.id, ...license(), file: PDF });
    if (!prepared.ok) throw new Error("prepare failed");
    // Nothing was uploaded: storage does not know the path.
    const saved = await savePaper({ vehicleId: car.id, ...license(), upload: { path: prepared.path, ownerId: prepared.ownerId } });
    expect(saved).toEqual({ ok: false, error: "The file did not arrive. Please try again." });
    expect(await snapshot()).toEqual(before);
  });

  it("storage being down creates nothing", async () => {
    const before = await snapshot();
    h.infoError = true;
    const { saved } = await add(license());
    expect(saved).toMatchObject({ ok: false });
    h.infoError = false;
    h.objects.clear();
    expect(await snapshot()).toEqual({ ...before, objects: [] });
  });

  it("a file that is too big or the wrong type creates nothing, and its object is removed", async () => {
    const before = await snapshot();
    const big = await add(license(), { size: 11 * 1024 * 1024 });
    expect(big.prepared).toMatchObject({ ok: false, error: expect.stringMatching(/too large/) });
    const notAllowed = await add(license(), { contentType: "application/zip" });
    expect(notAllowed.prepared).toMatchObject({ ok: false, error: expect.stringMatching(/Only JPEG/) });
    // A browser that lies at prepare time: storage reports something else.
    const prepared = await preparePaper({ vehicleId: car.id, ...license(), file: PDF });
    if (!prepared.ok) throw new Error("prepare failed");
    h.objects.set(prepared.path, { size: 12 * 1024 * 1024, contentType: "application/pdf" });
    const saved = await savePaper({ vehicleId: car.id, ...license(), upload: { path: prepared.path, ownerId: prepared.ownerId } });
    expect(saved).toMatchObject({ ok: false, error: expect.stringMatching(/too large/) });
    expect(h.objects.has(prepared.path)).toBe(false);
    expect(await snapshot()).toEqual(before);
  });

  it("a failing database step rolls everything back and removes the object: no record, the old one still current", async () => {
    await h.db.insert(vehicleRenewals).values({ vehicleId: car.id, type: "Revenue license", startDate: "2026-03-03", expiryDate: "2027-03-02" });
    const before = await snapshot();
    // Storage reports a size the database cannot store, so the last write of the transaction fails, after the
    // new record was written and the old one marked renewed.
    const prepared = await preparePaper({ vehicleId: car.id, ...license(), file: PDF });
    if (!prepared.ok) throw new Error("prepare failed");
    h.objects.set(prepared.path, { size: 1000.5, contentType: "application/pdf" });
    const saved = await savePaper({ vehicleId: car.id, ...license(), upload: { path: prepared.path, ownerId: prepared.ownerId } });
    expect(saved).toEqual({ ok: false, error: "Something went wrong. Please try again." });
    expect(h.objects.has(prepared.path)).toBe(false);
    expect(h.removed).toContain(prepared.path);
    const after = await snapshot();
    expect(after).toEqual({ ...before, objects: [] });
    expect((await renewals())[0].renewedAt).toBeNull();
  });

  it("the same for a service: no service row without its invoice's row", async () => {
    const prepared = await preparePaper({ vehicleId: car.id, kind: "service", fields: { serviceDate: "2026-06-14", serviceType: "Tyres" }, file: PDF });
    if (!prepared.ok) throw new Error("prepare failed");
    h.objects.set(prepared.path, { size: 1000.5, contentType: "application/pdf" });
    const saved = await savePaper({ vehicleId: car.id, kind: "service", fields: { serviceDate: "2026-06-14", serviceType: "Tyres" }, upload: { path: prepared.path, ownerId: prepared.ownerId } });
    expect(saved.ok).toBe(false);
    expect(await services()).toEqual([]);
    expect(h.objects.size).toBe(0);
  });

  it("a failing database step never removes an object a saved file uses", async () => {
    await add(license());
    const [saved] = await files();
    // A second submit of the same form: the path is already a saved file's.
    const again = await savePaper({ vehicleId: car.id, ...license({ expiryDate: "2029-03-02" }), upload: { path: saved.storagePath, ownerId: saved.ownerId } });
    expect(again).toMatchObject({ ok: false, error: "Already saved." });
    expect(h.objects.has(saved.storagePath)).toBe(true);
    expect(await renewals()).toHaveLength(1);
  });

  it("when the object cannot be removed either, still nothing is saved (the leftover is only logged)", async () => {
    const prepared = await preparePaper({ vehicleId: car.id, ...license(), file: PDF });
    if (!prepared.ok) throw new Error("prepare failed");
    h.objects.set(prepared.path, { size: 1000.5, contentType: "application/pdf" });
    h.removeError = true;
    const saved = await savePaper({ vehicleId: car.id, ...license(), upload: { path: prepared.path, ownerId: prepared.ownerId } });
    expect(saved.ok).toBe(false);
    expect(await renewals()).toEqual([]);
    expect(await files()).toEqual([]);
  });

  it("invalid fields are refused before anything is uploaded", async () => {
    const before = await snapshot();
    const { prepared } = await add(license({ expiryDate: "2028-02-30" }));
    expect(prepared).toMatchObject({ ok: false, error: expect.stringMatching(/valid date/) });
    expect(h.signed).toEqual([]);
    expect(await snapshot()).toEqual(before);
  });
});

describe("who may do what", () => {
  it("both: the record and its file", async () => {
    signIn(BOTH);
    expect((await add(license())).saved).toEqual({ ok: true });
    expect(await renewals()).toHaveLength(1);
    expect(await files()).toHaveLength(1);
  });

  it("only Vehicle documents: the paper is kept on file with no record and no reminders", async () => {
    signIn(DOCS_ONLY);
    expect((await add(license())).saved).toEqual({ ok: true });
    expect(await renewals()).toEqual([]);
    const [f] = await files();
    expect(f).toMatchObject({ ownerType: "vehicle", ownerId: car.id, fileName: "TST-1234_license_2028-03-02.pdf", title: "Revenue license until 2028-03-02" });
    // A service invoice is kept as an Other paper, and no service is made.
    expect((await add({ kind: "service", fields: { serviceDate: "2026-06-14", serviceType: "Oil change" } })).saved).toEqual({ ok: true });
    expect(await services()).toEqual([]);
    expect((await files())[1]).toMatchObject({ ownerType: "vehicle", fileName: "TST-1234_service-invoice_2026-06-14.pdf", title: "Service invoice" });
    // Books and Other work as for everyone.
    expect((await add({ kind: "other", fields: { title: "TEST upload", date: "2000-01-01" } })).saved).toEqual({ ok: true });
  });

  it("only Vehicle documents cannot make a record by crafting the request", async () => {
    signIn(DOCS_ONLY);
    // Every field a record needs, an attach flag and a made-up id: still only a document.
    const prepared = await preparePaper({ vehicleId: car.id, ...license(), attach: true, file: PDF });
    if (!prepared.ok) throw new Error("prepare failed");
    expect(prepared.path.startsWith(`vehicle/${car.id}/`)).toBe(true);
    h.objects.set(prepared.path, { size: 1000, contentType: "application/pdf" });
    const fake = crypto.randomUUID();
    const saved = await savePaper({ vehicleId: car.id, ...license(), attach: true, upload: { path: prepared.path, ownerId: fake } });
    expect(saved).toEqual({ ok: true });
    expect(await renewals()).toEqual([]);
    expect(await services()).toEqual([]);
    expect((await files())[0].ownerType).toBe("vehicle");
  });

  it("only Vehicles add: the record is saved without a file", async () => {
    signIn(RECORDS_ONLY);
    expect((await add(license(), { file: false })).saved).toEqual({ ok: true });
    expect(await renewals()).toHaveLength(1);
    expect(await files()).toEqual([]);
    expect((await add({ kind: "service", fields: { serviceDate: "2026-06-14", serviceType: "Tyres" } }, { file: false })).saved).toEqual({ ok: true });
    expect(await services()).toHaveLength(1);
  });

  it("only Vehicles add cannot attach a file by crafting the request, and the object is left alone", async () => {
    signIn(RECORDS_ONLY);
    const before = await snapshot();
    // Preparing is refused.
    expect(await preparePaper({ vehicleId: car.id, ...license(), file: PDF })).toEqual({ ok: false, error: "Adding the file needs Add access to Vehicle documents." });
    expect(h.signed).toEqual([]);
    // So is saving with a path someone else put in storage (the owner's own upload, for instance).
    signIn(OWNER);
    const prepared = await preparePaper({ vehicleId: car.id, ...license(), file: PDF });
    if (!prepared.ok) throw new Error("prepare failed");
    h.objects.set(prepared.path, { size: 1000, contentType: "application/pdf" });
    signIn(RECORDS_ONLY);
    const saved = await savePaper({ vehicleId: car.id, ...license(), upload: { path: prepared.path, ownerId: prepared.ownerId } });
    expect(saved).toEqual({ ok: false, error: "Adding the file needs Add access to Vehicle documents." });
    expect(h.objects.has(prepared.path)).toBe(true); // not theirs to delete
    expect(await renewals()).toEqual([]);
    expect({ ...(await snapshot()), objects: [] }).toEqual({ ...before, objects: [] });
  });

  it("only Vehicles add has no book or Other", async () => {
    signIn(RECORDS_ONLY);
    for (const kind of ["book", "other"]) {
      expect((await add({ kind, fields: { title: "x", date: "2000-01-01" } }, { file: false })).saved).toEqual({ ok: false, error: "You are not allowed to add this paper." });
    }
    expect(await files()).toEqual([]);
  });

  it("neither is refused everywhere, for every kind, preparing and saving", async () => {
    signIn(NEITHER);
    const before = await snapshot();
    for (const kind of ["license", "insurance", "emission", "book", "service", "other"]) {
      const fields = { expiryDate: "2028-03-02", serviceDate: "2026-06-14", serviceType: "Tyres", title: "x", date: "2000-01-01" };
      expect(await preparePaper({ vehicleId: car.id, kind, fields, file: PDF })).toEqual({ ok: false, error: "You are not allowed to add this paper." });
      expect(await savePaper({ vehicleId: car.id, kind, fields })).toEqual({ ok: false, error: "You are not allowed to add this paper." });
    }
    expect(await snapshot()).toEqual(before);
  });

  it("the owner may do everything", async () => {
    signIn(OWNER);
    expect((await add({ kind: "book", fields: {} })).saved).toEqual({ ok: true });
  });

  it("a signed-out visitor, a person waiting for approval and a blocked person are refused", async () => {
    const before = await snapshot();
    h.userId = null;
    h.email = "";
    expect(await preparePaper({ vehicleId: car.id, ...license(), file: PDF })).toMatchObject({ ok: false });
    expect(await savePaper({ vehicleId: car.id, ...license() })).toMatchObject({ ok: false });
    await h.db.insert(people).values({ email: "waiting@example.com", status: "pending" });
    await h.db.insert(people).values({ email: "blocked@example.com", status: "blocked" });
    for (const email of ["waiting@example.com", "blocked@example.com", "stranger@example.com"]) {
      signIn(email);
      expect(await savePaper({ vehicleId: car.id, ...license() })).toMatchObject({ ok: false });
    }
    expect(await snapshot()).toEqual(before);
  });
});

describe("a person cannot reach more than their grants by crafting the request", () => {
  it("a vehicle that does not exist, a made-up kind and a bad id are refused", async () => {
    const before = await snapshot();
    expect(await savePaper({ vehicleId: crypto.randomUUID(), ...license() })).toEqual({ ok: false, error: "That vehicle could not be found." });
    expect(await savePaper({ vehicleId: "../etc", ...license() })).toEqual({ ok: false, error: "That vehicle could not be found." });
    expect(await savePaper({ vehicleId: car.id, kind: "passport", fields: {} })).toEqual({ ok: false, error: "Choose what the paper is." });
    expect(await savePaper({ vehicleId: car.id, kind: { toString: () => "license" } as never, fields: {} })).toMatchObject({ ok: false });
    expect(await snapshot()).toEqual(before);
  });

  it("a path in another record's folder is refused and that object is left alone", async () => {
    const [theirs] = await h.db.insert(vehicleRenewals).values({ vehicleId: otherCar.id, type: "Insurance", expiryDate: "2027-01-01" }).returning();
    const foreign = `vehicle_renewal/${theirs.id}/${crypto.randomUUID()}-scan.pdf`;
    h.objects.set(foreign, { size: 1000, contentType: "application/pdf" });
    const saved = await savePaper({ vehicleId: car.id, ...license(), upload: { path: foreign, ownerId: crypto.randomUUID() } });
    expect(saved).toEqual({ ok: false, error: "That upload does not belong here. Please try again." });
    expect(h.objects.has(foreign)).toBe(true);
    expect(await renewals()).toEqual([]);
    expect(await files()).toEqual([]);
  });

  it("a path with .. or a sub-folder is refused", async () => {
    const id = crypto.randomUUID();
    for (const path of [`vehicle_renewal/${id}/../x.pdf`, `vehicle_renewal/${id}/a/${crypto.randomUUID()}-x.pdf`, `vehicle/${car.id}/${crypto.randomUUID()}-x.pdf`]) {
      h.objects.set(path, { size: 1000, contentType: "application/pdf" });
      expect(await savePaper({ vehicleId: car.id, ...license(), upload: { path, ownerId: id } })).toMatchObject({ ok: false });
    }
    expect(await renewals()).toEqual([]);
  });

  it("taking another record's id as the new record's id fails whole: nothing is renewed, the object is removed", async () => {
    const [theirs] = await h.db.insert(vehicleRenewals).values({ vehicleId: otherCar.id, type: "Insurance", expiryDate: "2027-01-01" }).returning();
    await h.db.insert(vehicleRenewals).values({ vehicleId: car.id, type: "Revenue license", startDate: "2026-03-03", expiryDate: "2027-03-02" });
    const crafted = `vehicle_renewal/${theirs.id}/${crypto.randomUUID()}-x.pdf`;
    h.objects.set(crafted, { size: 1000, contentType: "application/pdf" });
    const before = { ...(await snapshot()), objects: [] as string[] };
    const saved = await savePaper({ vehicleId: car.id, ...license(), upload: { path: crafted, ownerId: theirs.id } });
    expect(saved.ok).toBe(false);
    expect(h.objects.has(crafted)).toBe(false);
    expect({ ...(await snapshot()), objects: [] }).toEqual(before);
    expect((await renewals(otherCar.id))[0].renewedAt).toBeNull();
  });

  it("a record's twin on another vehicle is not a twin", async () => {
    await h.db.insert(vehicleRenewals).values({ vehicleId: otherCar.id, type: "Revenue license", expiryDate: "2028-03-02" });
    const { saved } = await add(license());
    expect(saved).toEqual({ ok: true });
    expect(await renewals()).toHaveLength(1);
    expect(await renewals(otherCar.id)).toHaveLength(1);
    expect(await files()).toHaveLength(1);
  });

  it("the attach flag cannot choose which record gets the file: the server finds the twin on this vehicle", async () => {
    const [theirs] = await h.db.insert(vehicleRenewals).values({ vehicleId: otherCar.id, type: "Revenue license", expiryDate: "2030-01-01" }).returning();
    const { saved } = await add({ ...license(), attach: true });
    expect(saved).toEqual({ ok: true });
    expect((await files()).map((f) => f.ownerId)).not.toContain(theirs.id);
    expect(await renewals(otherCar.id)).toHaveLength(1);
  });
});

describe("no duplicates", () => {
  it("offers to attach the file to the same-day record that has none, and then does, without a new record", async () => {
    const [twin] = await h.db.insert(vehicleRenewals).values({ vehicleId: car.id, type: "Revenue license", startDate: "2027-03-03", expiryDate: "2028-03-02" }).returning();
    const first = await add(license());
    expect(first.prepared).toEqual({ ok: false, error: "A license ending 2 Mar 2028 is already saved, without its scan.", canAttach: true });
    expect(h.signed).toEqual([]);
    expect(await files()).toEqual([]);

    const second = await add({ ...license(), attach: true });
    expect(second.saved).toEqual({ ok: true });
    expect(await renewals()).toHaveLength(1);
    const [f] = await files();
    expect(f).toMatchObject({ ownerType: "vehicle_renewal", ownerId: twin.id, fileName: "TST-1234_license_2028-03-02.pdf" });
    expect(f.storagePath.startsWith(`vehicle_renewal/${twin.id}/`)).toBe(true);
  });

  it("attaching to the twin does not renew anything or change the record", async () => {
    const [older] = await h.db.insert(vehicleRenewals).values({ vehicleId: car.id, type: "Revenue license", startDate: "2026-03-03", expiryDate: "2027-03-02" }).returning();
    const [twin] = await h.db.insert(vehicleRenewals).values({ vehicleId: car.id, type: "Revenue license", provider: "Kept", startDate: "2027-03-03", expiryDate: "2028-03-02" }).returning();
    await add({ ...license({ provider: "Changed" }), attach: true });
    const rows = await renewals();
    expect(rows.map((r) => [r.id, r.provider, r.renewedAt])).toEqual([[older.id, null, null], [twin.id, "Kept", null]]);
  });

  it("refuses when the same-day record already has its scan, and uploads nothing", async () => {
    const [twin] = await h.db.insert(vehicleRenewals).values({ vehicleId: car.id, type: "Revenue license", expiryDate: "2028-03-02" }).returning();
    await h.db.insert(attachments).values({ ownerType: "vehicle_renewal", ownerId: twin.id, storagePath: `vehicle_renewal/${twin.id}/x`, fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 1 });
    for (const attach of [false, true]) {
      const { prepared } = await add({ ...license(), attach });
      expect(prepared).toEqual({ ok: false, error: "A license ending 2 Mar 2028 is already saved with its scan." });
    }
    expect(h.signed).toEqual([]);
    expect(await renewals()).toHaveLength(1);
    expect(await files()).toHaveLength(1);
  });

  it("refuses a record with no file when one already exists, with or without its scan", async () => {
    const [twin] = await h.db.insert(vehicleRenewals).values({ vehicleId: car.id, type: "Revenue license", expiryDate: "2028-03-02" }).returning();
    expect((await add(license(), { file: false })).saved).toEqual({ ok: false, error: "A license ending 2 Mar 2028 is already saved, without its scan." });
    await h.db.insert(attachments).values({ ownerType: "vehicle_renewal", ownerId: twin.id, storagePath: `vehicle_renewal/${twin.id}/x`, fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 1 });
    expect((await add(license(), { file: false })).saved).toEqual({ ok: false, error: "A license ending 2 Mar 2028 is already saved with its scan." });
    expect(await renewals()).toHaveLength(1);
  });

  it("a person who may only add records is told it exists and cannot attach", async () => {
    signIn(RECORDS_ONLY);
    await h.db.insert(vehicleRenewals).values({ vehicleId: car.id, type: "Revenue license", expiryDate: "2028-03-02" });
    expect((await add({ ...license(), attach: true }, { file: false })).saved).toEqual({ ok: false, error: "A license ending 2 Mar 2028 is already saved, without its scan." });
    expect(await files()).toEqual([]);
  });

  it("a twin made between preparing and saving is caught inside the transaction and the object is removed", async () => {
    const prepared = await preparePaper({ vehicleId: car.id, ...license(), file: PDF });
    if (!prepared.ok) throw new Error("prepare failed");
    h.objects.set(prepared.path, { size: 1000, contentType: "application/pdf" });
    // Meanwhile somebody else saves the same license... after the check in planPaper would not see it; here before, so
    // savePaper's own check sees it first. Either way: one record only, and no object left.
    await h.db.insert(vehicleRenewals).values({ vehicleId: car.id, type: "Revenue license", expiryDate: "2028-03-02" });
    const saved = await savePaper({ vehicleId: car.id, ...license(), upload: { path: prepared.path, ownerId: prepared.ownerId } });
    expect(saved).toMatchObject({ ok: false, canAttach: true });
    expect(await renewals()).toHaveLength(1);
    expect(await files()).toEqual([]);
    expect(h.objects.has(prepared.path)).toBe(false);
  });

  it("a different kind or a different end date is not a twin", async () => {
    await h.db.insert(vehicleRenewals).values([
      { vehicleId: car.id, type: "Insurance", expiryDate: "2028-03-02" },
      { vehicleId: car.id, type: "Revenue license", expiryDate: "2028-03-01" },
    ]);
    expect((await add(license())).saved).toEqual({ ok: true });
    expect(await renewals()).toHaveLength(3);
  });

  it("an Other paper is never a duplicate", async () => {
    await add({ kind: "other", fields: { title: "Thing", date: "2000-01-01" } });
    expect((await add({ kind: "other", fields: { title: "Thing", date: "2000-01-01" } })).saved).toEqual({ ok: true });
    expect(await files()).toHaveLength(2);
  });
});

describe("the history of a kind stays right", () => {
  it("adding three years out of order leaves one current license and the rest renewed in order", async () => {
    await add(license({ startDate: "2026-03-03", expiryDate: "2027-03-02" }));
    await add(license({ startDate: "2024-03-03", expiryDate: "2025-03-02" }));
    await add(license({ startDate: "2025-03-03", expiryDate: "2026-03-02" }));
    await add(license({ startDate: "2027-03-03", expiryDate: "2028-03-02" }));
    const rows = await renewals();
    // The 2025 paper went in when the next later one was the 2027 paper (started 3 Mar 2026): its renewed day is what was known then.
    expect(rows.map((r) => [r.expiryDate, r.renewedAt?.toISOString().slice(0, 10) ?? null])).toEqual([
      ["2025-03-02", "2026-03-03"],
      ["2026-03-02", "2026-03-03"],
      ["2027-03-02", "2027-03-03"],
      ["2028-03-02", null],
    ]);
    // Exactly one record is current, and every record has its scan.
    expect(rows.filter((r) => r.renewedAt === null)).toHaveLength(1);
    expect(await files()).toHaveLength(4);
  });

  it("deleting the paper's record later is unchanged: its file is removed with it (cleanup)", async () => {
    await add(license());
    const [r] = await renewals();
    const { deleteAttachmentsOf } = await import("@/features/shared/cleanup");
    await deleteAttachmentsOf("vehicle_renewal", r.id);
    expect(await files()).toEqual([]);
    expect(h.objects.size).toBe(0);
  });
});

describe("what is stored about the file", () => {
  it("the stored size and type are what storage reports, not what the browser said", async () => {
    const prepared = await preparePaper({ vehicleId: car.id, ...license(), file: PDF });
    if (!prepared.ok) throw new Error("prepare failed");
    h.objects.set(prepared.path, { size: 2048, contentType: "image/png" });
    await savePaper({ vehicleId: car.id, ...license(), upload: { path: prepared.path, ownerId: prepared.ownerId } });
    const [f] = await h.db.select().from(attachments).where(and(eq(attachments.ownerType, "vehicle_renewal")));
    expect(f).toMatchObject({ sizeBytes: 2048, mimeType: "image/png", fileName: "TST-1234_license_2028-03-02.png" });
  });
});
