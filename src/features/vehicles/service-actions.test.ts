import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The service actions (V.1a, C147). The database, the access check and the file cleanup are fakes, so only the
 * actions' own rules are tested: the oil-change marker createService fills in itself, that updateService never
 * recomputes a date, and that deleting a service deletes its files first.
 */

const state = vi.hoisted(() => ({
  selects: [] as unknown[][],
  calls: [] as string[],
  inserted: [] as Record<string, unknown>[],
  updated: [] as Record<string, unknown>[],
  rules: { oilChangeMonths: 6, oilChangeKm: 2500, oilChangeTypes: ["Oil change", "Full service"] as string[] },
  denied: false,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: () => state.calls.push("refresh") }));
vi.mock("@/lib/auth", async () => {
  const { ValidationError } = await import("@/features/shared/validation");
  return {
    requireUser: vi.fn(async (need: unknown) => {
      state.calls.push(`requireUser ${JSON.stringify(need)}`);
      if (state.denied) throw new ValidationError("Not allowed.");
      return {};
    }),
  };
});
vi.mock("@/features/settings/queries", () => ({ loadRules: async () => state.rules }));
vi.mock("@/features/shared/cleanup", () => ({
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
      select: () => chain(state.selects.shift() ?? []),
      insert: () => ({
        values: (v: Record<string, unknown>) => {
          state.inserted.push(v);
          return { returning: async () => [{ id: "55555555-5555-4555-8555-555555555555" }] };
        },
      }),
      update: () => ({ set: (v: Record<string, unknown>) => ({ where: async () => void state.updated.push(v) }) }),
      delete: () => ({ where: async () => void state.calls.push("db.delete") }),
    },
  };
});

import { createService, deleteService, updateService } from "./service-actions";

const VEHICLE = "11111111-1111-4111-8111-111111111111";
const SERVICE = "22222222-2222-4222-8222-222222222222";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}
const create = (fields: Record<string, string>) => createService({ ok: false }, form({ vehicleId: VEHICLE, serviceDate: "2026-06-14", serviceType: "Oil change", ...fields }));

beforeEach(() => {
  state.selects = [[{ id: VEHICLE }]];
  state.calls = [];
  state.inserted = [];
  state.updated = [];
  state.denied = false;
  state.rules = { oilChangeMonths: 6, oilChangeKm: 2500, oilChangeTypes: ["Oil change", "Full service"] };
});

describe("createService and the oil-change marker", () => {
  it("needs Add in Vehicles before anything else", async () => {
    state.denied = true;
    expect(await create({})).toEqual({ ok: false, error: "Not allowed." });
    expect(state.calls).toEqual(['requireUser {"area":"vehicles","level":"add"}']);
    expect(state.inserted).toEqual([]);
  });

  it("fills the next due date itself for an oil change when the field is blank, and says the new id", async () => {
    expect(await create({})).toEqual({ ok: true, id: "55555555-5555-4555-8555-555555555555" });
    expect(state.inserted[0]).toMatchObject({ vehicleId: VEHICLE, serviceType: "Oil change", nextDueDate: "2026-12-14" });
  });

  it("uses the rule in force: its months and its list of types", async () => {
    state.rules = { oilChangeMonths: 3, oilChangeKm: 1000, oilChangeTypes: ["Engine oil"] };
    await create({ serviceType: "engine  OIL" });
    expect(state.inserted[0]).toMatchObject({ nextDueDate: "2026-09-14" });
    state.selects = [[{ id: VEHICLE }]];
    await create({ serviceType: "Oil change" });
    expect(state.inserted[1]).toMatchObject({ nextDueDate: null });
  });

  it("clamps to the month end", async () => {
    await create({ serviceDate: "2026-08-31" });
    expect(state.inserted[0]).toMatchObject({ nextDueDate: "2027-02-28" });
  });

  it("keeps a date the person changed it to", async () => {
    await create({ nextDueDate: "2026-10-20", markerRemind: "on" });
    expect(state.inserted[0]).toMatchObject({ nextDueDate: "2026-10-20" });
  });

  it("saves no date when the 'remind me' switch is off, even if a date came with it", async () => {
    await create({ markerRemind: "off" });
    expect(state.inserted[0]).toMatchObject({ nextDueDate: null });
    state.selects = [[{ id: VEHICLE }]];
    await create({ markerRemind: "off", nextDueDate: "2026-12-14" });
    expect(state.inserted[1]).toMatchObject({ nextDueDate: null });
  });

  it("leaves a type outside the list alone: the typed next-due date is saved, a blank one stays blank", async () => {
    await create({ serviceType: "Tyres" });
    expect(state.inserted[0]).toMatchObject({ nextDueDate: null });
    state.selects = [[{ id: VEHICLE }]];
    await create({ serviceType: "Tyres", nextDueDate: "2027-03-01", markerRemind: "off" });
    expect(state.inserted[1]).toMatchObject({ nextDueDate: "2027-03-01" });
  });

  it("still refuses a next due date before the service date", async () => {
    const result = await create({ nextDueDate: "2026-06-01" });
    expect(result.ok).toBe(false);
    expect(state.inserted).toEqual([]);
  });

  it("refuses a vehicle that does not exist", async () => {
    state.selects = [[]];
    expect((await create({})).ok).toBe(false);
    expect(state.inserted).toEqual([]);
  });
});

describe("updateService", () => {
  it("never recomputes the date: a blank field on an oil change stays blank", async () => {
    state.selects = [[{ id: SERVICE, vehicleId: VEHICLE }]];
    const result = await updateService({ ok: false }, form({ id: SERVICE, serviceDate: "2026-06-14", serviceType: "Oil change", nextDueDate: "" }));
    expect(result).toEqual({ ok: true });
    expect(state.updated[0]).toMatchObject({ nextDueDate: null });
    expect(state.calls[0]).toBe('requireUser {"area":"vehicles","level":"edit"}');
  });

  it("saves the date the form sent", async () => {
    state.selects = [[{ id: SERVICE, vehicleId: VEHICLE }]];
    await updateService({ ok: false }, form({ id: SERVICE, serviceDate: "2026-06-14", serviceType: "Oil change", nextDueDate: "2026-11-02" }));
    expect(state.updated[0]).toMatchObject({ nextDueDate: "2026-11-02" });
  });
});

describe("deleteService", () => {
  it("needs Edit in Vehicles and deletes the service's files and notes before its row", async () => {
    await deleteService(form({ id: SERVICE }));
    expect(state.calls).toEqual(['requireUser {"area":"vehicles","level":"edit"}', `deleteSharedDataOf vehicle_service ${SERVICE}`, "db.delete", "refresh"]);
  });

  it("deletes nothing when the person is not allowed", async () => {
    state.denied = true;
    await expect(deleteService(form({ id: SERVICE }))).rejects.toThrow("Not allowed.");
    expect(state.calls).toEqual(['requireUser {"area":"vehicles","level":"edit"}']);
  });
});
