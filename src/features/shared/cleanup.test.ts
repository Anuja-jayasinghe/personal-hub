import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cleaning up a service's files (V.1a, C147): files belong to a record by owner type and id with no foreign
 * key, so deleting a service, or a vehicle with its services, must remove every invoice (storage first, then
 * the rows) in code. The database and the storage client are fakes that record what they are asked to do.
 */

const state = vi.hoisted(() => ({
  selects: [] as unknown[][],
  removed: [] as string[][],
  deletes: 0,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/storage", () => ({
  ATTACHMENT_BUCKET: "attachments",
  storageClient: () => ({
    storage: { from: () => ({ remove: async (paths: string[]) => (state.removed.push(paths), { error: null }) }) },
  }),
}));
vi.mock("@/db", () => {
  type Chain = { from: () => Chain; where: () => Chain; then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise<unknown> };
  const chain = (result: unknown): Chain => {
    const c: Chain = { from: () => c, where: () => c, then: (ok, bad) => Promise.resolve(result).then(ok, bad) };
    return c;
  };
  return {
    db: {
      select: () => chain(state.selects.shift() ?? []),
      delete: () => ({ where: async () => void state.deletes++ }),
    },
  };
});

import { deleteServiceDataOfVehicle, deleteSharedDataOf } from "./cleanup";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

beforeEach(() => {
  state.selects = [];
  state.removed = [];
  state.deletes = 0;
});

describe("deleteSharedDataOf for a service", () => {
  it("removes the invoice's file from storage, then its row", async () => {
    // tasks, notes, then the service's own attachments
    state.selects = [[], [], [{ storagePath: `vehicle_service/${A}/one.pdf` }]];
    await deleteSharedDataOf("vehicle_service", A);
    expect(state.removed).toEqual([[`vehicle_service/${A}/one.pdf`]]);
    expect(state.deletes).toBeGreaterThanOrEqual(1);
  });
});

describe("deleteSharedDataOf for a cheque (issue #178)", () => {
  it("removes both photos from storage, then their rows, so no picture of a cheque is left behind", async () => {
    // tasks, notes, then the cheque's own attachments (front and back)
    state.selects = [[], [], [{ storagePath: `cheque/${A}/one.jpg` }, { storagePath: `cheque/${A}/two.jpg` }]];
    await deleteSharedDataOf("cheque", A);
    expect(state.removed).toEqual([[`cheque/${A}/one.jpg`, `cheque/${A}/two.jpg`]]);
    expect(state.deletes).toBeGreaterThanOrEqual(1);
  });
});

describe("deleteServiceDataOfVehicle", () => {
  it("removes the files of every service of the vehicle, so no invoice is left behind", async () => {
    state.selects = [
      [{ id: A }, { id: B }], // the vehicle's services
      [], [], [{ storagePath: `vehicle_service/${A}/one.pdf` }, { storagePath: `vehicle_service/${A}/two.jpg` }], // A: tasks, notes, files
      [], [], [{ storagePath: `vehicle_service/${B}/three.pdf` }], // B: tasks, notes, files
    ];
    await deleteServiceDataOfVehicle("vehicle-id");
    expect(state.removed).toEqual([[`vehicle_service/${A}/one.pdf`, `vehicle_service/${A}/two.jpg`], [`vehicle_service/${B}/three.pdf`]]);
  });

  it("does nothing for a vehicle with no services", async () => {
    state.selects = [[]];
    await deleteServiceDataOfVehicle("vehicle-id");
    expect(state.removed).toEqual([]);
  });

  it("stops before deleting any row when storage refuses, so a failed delete can be retried", async () => {
    vi.resetModules();
    state.selects = [[{ id: A }], [], [], [{ storagePath: `vehicle_service/${A}/one.pdf` }]];
    vi.doMock("@/lib/storage", () => ({
      ATTACHMENT_BUCKET: "attachments",
      storageClient: () => ({ storage: { from: () => ({ remove: async () => ({ error: { message: "nope" } }) }) } }),
    }));
    const fresh = await import("./cleanup");
    await expect(fresh.deleteServiceDataOfVehicle("vehicle-id")).rejects.toThrow(/Could not delete files/);
    expect(state.deletes).toBe(0);
  });
});
