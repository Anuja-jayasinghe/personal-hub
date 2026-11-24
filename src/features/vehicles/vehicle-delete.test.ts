import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Deleting a vehicle removes the files of its renewals AND of its services (V.1a, C147), and does it before the
 * vehicle row goes, because the database deletes the service rows along with the vehicle but cannot reach the files.
 */

const state = vi.hoisted(() => ({ calls: [] as string[], denied: false }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: () => {} }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => state.calls.push(`redirect ${to}`) }));
vi.mock("@/lib/auth", async () => {
  const { ValidationError } = await import("@/features/shared/validation");
  return {
    requireUser: async (need: unknown) => {
      state.calls.push(`requireUser ${JSON.stringify(need)}`);
      if (state.denied) throw new ValidationError("Not allowed.");
    },
  };
});
vi.mock("@/lib/storage", () => ({ COVER_TYPE_MESSAGE: "", COVER_TYPES: [] }));
vi.mock("@/features/shared/files", () => ({ recordUpload: vi.fn(), removeAttachment: vi.fn(), uploadedFrom: vi.fn() }));
vi.mock("@/features/shared/cleanup", () => ({
  deleteAttachmentsOf: async (type: string, id: string) => void state.calls.push(`deleteAttachmentsOf ${type} ${id}`),
  deleteServiceDataOfVehicle: async (id: string) => void state.calls.push(`deleteServiceDataOfVehicle ${id}`),
  deleteSharedDataOf: async (type: string, id: string) => void state.calls.push(`deleteSharedDataOf ${type} ${id}`),
}));
vi.mock("@/db", () => {
  type Chain = { from: () => Chain; where: () => Chain; then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise<unknown> };
  const chain = (result: unknown): Chain => {
    const c: Chain = { from: () => c, where: () => c, then: (ok, bad) => Promise.resolve(result).then(ok, bad) };
    return c;
  };
  return {
    db: {
      select: () => chain([{ id: "99999999-9999-4999-8999-999999999999" }]),
      delete: () => ({ where: async () => void state.calls.push("db.delete vehicle") }),
    },
  };
});

import { deleteVehicle } from "./actions";

const VEHICLE = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  state.calls = [];
  state.denied = false;
});

describe("deleteVehicle", () => {
  it("removes renewal files, service files, then the vehicle's own data, and only then the vehicle", async () => {
    const fd = new FormData();
    fd.set("id", VEHICLE);
    await deleteVehicle(fd);
    expect(state.calls).toEqual([
      'requireUser {"area":"vehicles","level":"edit"}',
      "deleteAttachmentsOf vehicle_renewal 99999999-9999-4999-8999-999999999999",
      `deleteServiceDataOfVehicle ${VEHICLE}`,
      `deleteSharedDataOf vehicle ${VEHICLE}`,
      "db.delete vehicle",
      "redirect /vehicles",
    ]);
  });

  it("deletes nothing for a person who may not", async () => {
    state.denied = true;
    const fd = new FormData();
    fd.set("id", VEHICLE);
    await expect(deleteVehicle(fd)).rejects.toThrow("Not allowed.");
    expect(state.calls).toEqual(['requireUser {"area":"vehicles","level":"edit"}']);
  });
});
