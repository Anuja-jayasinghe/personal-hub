import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * What the Documents tab reads (V.4, C151), over the demo's made-up vehicles in a real Postgres (PGlite): service
 * invoices appear under Other, titled "Service · type" with the service date, for THIS vehicle only, and the
 * cover photo is never a paper.
 */

const holder = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/db/read", () => ({ readDb: async () => holder.db }));

import type { Db } from "@/db/read";
import { attachments } from "@/db/schema";
import { DEMO_VEHICLES, demoId, demoRows } from "@/db/demo/data";
import { makeTestDb } from "@/test/pglite";
import { groupPapers } from "./papers";
import { loadVehiclePapers } from "./documents-data";

const TODAY = "2026-11-24";
let db: Db;

beforeAll(async () => {
  ({ db } = await makeTestDb({ today: TODAY }));
  holder.db = db;
  // The test database seeds the vehicles, renewals and services; the demo's files (papers and service invoices) go in here.
  await db.insert(attachments).values(demoRows(TODAY).attachments);
});

describe("the Documents tab's papers", () => {
  it("lists a vehicle's service invoices under Other, 'Service · type', with the service date, and only that vehicle's", async () => {
    const { papers } = await loadVehiclePapers(DEMO_VEHICLES.car, null);
    const services = papers.filter((p) => p.serviceId);
    expect(services.map((p) => p.serviceId)).toEqual([demoId(9, 2)]);
    for (const p of services) {
      expect(p).toMatchObject({ kind: "other", renewalId: null, name: "Service · Full service" });
      expect(p.files[0].fileName).toMatch(/^DEM-1234_service_\d{4}-\d{2}-\d{2}\.pdf$/);
    }
    expect(services.every((p) => p.dated && /^\d{4}-\d{2}-\d{2}$/.test(p.dated))).toBe(true);
    // None of the bike's or the scooter's invoices reach the car's page, and none of the car's reaches the bike's.
    expect(papers.flatMap((p) => p.files).some((f) => f.fileName.startsWith("DM-"))).toBe(false);
    const bike = await loadVehiclePapers(DEMO_VEHICLES.bike, null);
    expect(bike.papers.filter((p) => p.serviceId).map((p) => p.serviceId)).toEqual([demoId(9, 5)]);
    expect(bike.papers.filter((p) => p.serviceId)[0].name).toBe("Service · Oil change");
    expect(bike.papers.flatMap((p) => p.files).some((f) => f.fileName.startsWith("DEM-"))).toBe(false);
  });

  it("puts them in the Other category alongside the other papers on file", async () => {
    const { papers } = await loadVehiclePapers(DEMO_VEHICLES.car, null);
    const other = groupPapers(papers, TODAY).find((g) => g.kind === "other")!;
    expect(other.onFile.map((p) => p.name)).toEqual(["Service · Full service"]);
    expect(other.status).toMatchObject({ tone: "file" });
  });

  it("a service with no file is a record only, never a paper", async () => {
    const { papers } = await loadVehiclePapers(DEMO_VEHICLES.car, null);
    expect(papers.filter((p) => p.serviceId).map((p) => p.serviceId)).not.toContain(demoId(9, 3));
  });

  it("keeps the vehicle's cover photo out", async () => {
    const { documents } = await loadVehiclePapers(DEMO_VEHICLES.car, demoId(13, 21));
    expect(documents.map((d) => d.id)).not.toContain(demoId(13, 21));
  });

  it("a vehicle with no services, documents or renewals has no papers at all", async () => {
    const { papers } = await loadVehiclePapers(demoId(5, 99), null);
    expect(papers).toEqual([]);
  });
});
