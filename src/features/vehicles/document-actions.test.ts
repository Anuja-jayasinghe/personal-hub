import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Replace and rename on a vehicle's papers (issue #187, review of PR #199). The database, storage helpers
 * and the access check are fakes, so only the action's own rules are tested: who may call it, which files
 * it refuses, and that the old file goes only after the new one is recorded.
 */

const state = vi.hoisted(() => ({
  selects: [] as unknown[][],
  calls: [] as string[],
  area: "vehicle_documents" as string,
  denied: false,
  person: null as import("@/features/people/access").Access | null,
  recordFails: false,
  removeFails: false,
  updated: 0,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: () => state.calls.push("refresh") }));
vi.mock("@/lib/auth", async () => {
  const { ValidationError } = await import("@/features/shared/validation");
  return {
    requireUser: vi.fn(async (need: unknown) => {
      state.calls.push(`requireUser ${JSON.stringify(need)}`);
      if (state.denied) throw new ValidationError("Not allowed.");
      if (state.person) {
        // A chosen person's real grants against what the action asks for.
        const { allows } = await import("@/features/people/access");
        const n = need as { area: Parameters<typeof allows>[1]; level: Parameters<typeof allows>[2] };
        if (!allows(state.person, n.area, n.level)) throw new ValidationError("Not allowed.");
      }
      return {};
    }),
  };
});
vi.mock("@/features/people/file-area", () => ({ fileArea: async () => state.area }));
vi.mock("./doc-naming", () => ({ vehicleDocFileName: async () => "x.pdf" }));
vi.mock("@/features/shared/files", () => ({
  uploadedFrom: (fd: FormData) => ({ path: String(fd.get("uploadedPath")), fileName: String(fd.get("fileName") ?? "file") }),
  recordUpload: vi.fn(async () => {
    state.calls.push("recordUpload");
    if (state.recordFails) throw new Error("storage said no");
    return { id: "new" };
  }),
  removeAttachment: vi.fn(async () => {
    state.calls.push("removeAttachment");
    if (state.removeFails) throw new Error("could not delete");
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
      update: () => ({ set: () => ({ where: async () => void state.updated++ }) }),
    },
  };
});

import { accessFromGrants } from "@/features/people/access";
import { replacementName } from "./doc-names";
import { renameVehicleDocument, replaceVehicleFile } from "./document-actions";

const ID = "33333333-3333-4333-8333-333333333333";
const OWNER = "44444444-4444-4444-8444-444444444444";
const oldRow = { id: ID, ownerType: "vehicle_renewal", ownerId: OWNER, storagePath: `vehicle_renewal/${OWNER}/old.pdf`, fileName: "CAB-1234_insurance_2027-05-01.pdf", title: null };

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}
const replace = (path = `vehicle_renewal/${OWNER}/new.pdf`) => replaceVehicleFile({ ok: false }, form({ id: ID, uploadedPath: path, fileName: "new.pdf" }));

beforeEach(() => {
  state.selects = [];
  state.calls = [];
  state.area = "vehicle_documents";
  state.denied = false;
  state.person = null;
  state.recordFails = false;
  state.removeFails = false;
  state.updated = 0;
});

describe("replaceVehicleFile", () => {
  it("needs Edit in Vehicle documents before anything else", async () => {
    state.denied = true;
    expect(await replace()).toEqual({ ok: false, error: "Not allowed." });
    expect(state.calls).toEqual(['requireUser {"area":"vehicle_documents","level":"edit"}']);
  });

  it("refuses a vehicle's cover photo", async () => {
    state.selects = [[{ ...oldRow, ownerType: "vehicle" }]];
    state.area = "vehicles";
    expect((await replace()).ok).toBe(false);
    expect(state.calls).not.toContain("recordUpload");
    expect(state.calls).not.toContain("removeAttachment");
  });

  it("refuses a file that is not a vehicle paper", async () => {
    state.selects = [[{ ...oldRow, ownerType: "bill" }]];
    expect((await replace()).ok).toBe(false);
    expect(state.calls).not.toContain("recordUpload");
  });

  it("refuses the old file's own stored object as the new upload", async () => {
    state.selects = [[oldRow]];
    expect(await replace(oldRow.storagePath)).toEqual({ ok: false, error: "Choose the new file to upload." });
    expect(state.calls).not.toContain("recordUpload");
    expect(state.calls).not.toContain("removeAttachment");
  });

  it("removes the old file only after the new one is recorded", async () => {
    state.selects = [[oldRow], [{ id: ID, fileName: oldRow.fileName }]];
    expect(await replace()).toEqual({ ok: true });
    expect(state.calls.indexOf("recordUpload")).toBeGreaterThan(-1);
    expect(state.calls.indexOf("removeAttachment")).toBeGreaterThan(state.calls.indexOf("recordUpload"));
  });

  it("keeps the old file when the new one cannot be recorded", async () => {
    state.selects = [[oldRow], []];
    state.recordFails = true;
    expect((await replace()).ok).toBe(false);
    expect(state.calls).not.toContain("removeAttachment");
  });

  it("reports success with a notice when the old file cannot be removed", async () => {
    state.selects = [[oldRow], []];
    state.removeFails = true;
    const result = await replace();
    expect(result.ok).toBe(true);
    expect(result.notice).toMatch(/old one could not be removed/);
  });
});

/** An invoice on a service (V.4, C151): the same access as a renewal's file, and the service must still exist. */
describe("replaceVehicleFile on a service's invoice", () => {
  const SERVICE = "55555555-5555-4555-8555-555555555555";
  const invoice = { id: ID, ownerType: "vehicle_service", ownerId: SERVICE, storagePath: `vehicle_service/${SERVICE}/old.pdf`, fileName: "CAB-1234_service_2026-06-14.pdf", title: null };
  const replaceInvoice = (path = `vehicle_service/${SERVICE}/new.pdf`) => replaceVehicleFile({ ok: false }, form({ id: ID, uploadedPath: path, fileName: "new.pdf" }));
  const person = (...g: [string, string][]) => accessFromGrants(g.map(([area, level]) => ({ area, level })));

  it("replaces it, records the new file in the service's own folder, then removes the old one", async () => {
    state.selects = [[invoice], [{ id: SERVICE }], [{ id: ID, fileName: invoice.fileName }]];
    expect(await replaceInvoice()).toEqual({ ok: true });
    expect(state.calls).toContain("recordUpload");
    expect(state.calls.indexOf("removeAttachment")).toBeGreaterThan(state.calls.indexOf("recordUpload"));
  });

  it("keeps the hub name PLATE_service_<date> for the new file, with its own extension and a clash suffix", async () => {
    // The old name loses any `_2` and takes the new file's extension; a sibling with the plain name pushes it to `_2`.
    expect(replacementName("CAB-1234_service_2026-06-14.pdf", "jpg", [])).toBe("CAB-1234_service_2026-06-14.jpg");
    expect(replacementName("CAB-1234_service_2026-06-14_2.pdf", "pdf", ["CAB-1234_service_2026-06-14.pdf"])).toBe("CAB-1234_service_2026-06-14_2.pdf");
    expect(replacementName("CAB-1234_service_2026-06-14_3.pdf", "pdf", [])).toBe("CAB-1234_service_2026-06-14.pdf");
  });

  it("needs Edit in Vehicle documents: a person who may only see or add there is refused before anything is read", async () => {
    for (const level of ["see", "add"]) {
      state.person = person(["vehicle_documents", level], ["vehicles", "edit"]);
      state.selects = [[invoice], [{ id: SERVICE }]];
      state.calls = [];
      expect((await replaceInvoice()).ok).toBe(false);
      expect(state.calls).toEqual(['requireUser {"area":"vehicle_documents","level":"edit"}']);
      expect(state.selects).toHaveLength(2); // nothing was looked up
    }
  });

  it("Edit in Vehicles alone is not enough, and Edit in Vehicle documents is (the invoice follows the documents section)", async () => {
    state.person = person(["vehicles", "edit"]);
    expect((await replaceInvoice()).ok).toBe(false);
    state.person = person(["vehicle_documents", "edit"]);
    state.selects = [[invoice], [{ id: SERVICE }], []];
    expect(await replaceInvoice()).toEqual({ ok: true });
  });

  it("refuses an invoice whose service no longer exists, and an id that is not a file at all", async () => {
    state.selects = [[invoice], []];
    expect((await replaceInvoice()).ok).toBe(false);
    state.calls = [];
    state.selects = [[]];
    expect((await replaceInvoice()).ok).toBe(false);
    expect(state.calls).not.toContain("recordUpload");
    expect(state.calls).not.toContain("removeAttachment");
  });

  it("refuses a file that is not an invoice on a service of this kind (another owner type with the same id shape)", async () => {
    state.selects = [[{ ...invoice, ownerType: "task" }]];
    expect((await replaceInvoice()).ok).toBe(false);
    expect(state.calls).not.toContain("recordUpload");
  });

  it("refuses to 'replace' the invoice with its own stored object", async () => {
    state.selects = [[invoice], [{ id: SERVICE }]];
    expect(await replaceInvoice(invoice.storagePath)).toEqual({ ok: false, error: "Choose the new file to upload." });
    expect(state.calls).not.toContain("removeAttachment");
  });

  it("keeps the old invoice when the new one cannot be recorded", async () => {
    state.selects = [[invoice], [{ id: SERVICE }], []];
    state.recordFails = true;
    expect((await replaceInvoice()).ok).toBe(false);
    expect(state.calls).not.toContain("removeAttachment");
  });
});

describe("renameVehicleDocument", () => {
  it("renames a vehicle's document", async () => {
    state.selects = [[{ ...oldRow, ownerType: "vehicle" }]];
    expect(await renameVehicleDocument({ ok: false }, form({ id: ID, title: "Service invoice" }))).toEqual({ ok: true });
    expect(state.updated).toBe(1);
  });

  it("refuses the cover photo and a renewal's file", async () => {
    state.selects = [[{ ...oldRow, ownerType: "vehicle" }]];
    state.area = "vehicles";
    expect((await renameVehicleDocument({ ok: false }, form({ id: ID, title: "Mine now" }))).ok).toBe(false);
    state.area = "vehicle_documents";
    state.selects = [[oldRow]];
    expect((await renameVehicleDocument({ ok: false }, form({ id: ID, title: "Mine now" }))).ok).toBe(false);
    expect(state.updated).toBe(0);
  });
});
