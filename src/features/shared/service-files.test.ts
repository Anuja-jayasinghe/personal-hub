import { beforeEach, describe, expect, it, vi } from "vitest";
import { accessFromGrants, type Access } from "@/features/people/access";

/**
 * Files on a service (V.1a, C147): seeing, adding and deleting follow Vehicle documents like a renewal's
 * files do, the name is made by the hub from the service itself (its vehicle's plate and its date, never
 * from the request or the uploader's file name), and a service that does not exist cannot be attached to.
 * The database, storage and the access check are fakes; the access check is the real `allows` over a
 * chosen person, so the section mapping is what is being tested.
 */

const state = vi.hoisted(() => ({
  selects: [] as unknown[][],
  access: null as unknown as Access,
  signed: [] as { owner: unknown; file: { fileName: string } }[],
  recorded: [] as { owner: unknown; name: string }[],
  removed: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: () => {} }));
vi.mock("@/lib/auth", async () => {
  const { ValidationError } = await import("@/features/shared/validation");
  const { allows: can } = await import("@/features/people/access");
  return {
    requireUser: async (need: unknown) => {
      if (need === "signed-in") return {};
      const n = need as { area: Parameters<typeof can>[1]; level: Parameters<typeof can>[2] };
      if (!can(state.access, n.area, n.level)) throw new ValidationError("Not allowed.");
      return {};
    },
  };
});
vi.mock("@/lib/storage", () => ({ ATTACHMENT_BUCKET: "attachments", COVER_TYPES: [], COVER_TYPE_MESSAGE: "", storageClient: () => ({}) }));
vi.mock("@/features/people/file-area", async () => {
  const { areaOfFile } = await import("@/features/people/access");
  return { fileArea: async (f: { ownerType: string }) => areaOfFile(f.ownerType as never) };
});
vi.mock("./files", () => ({
  signUpload: async (owner: unknown, file: { fileName: string }) => (state.signed.push({ owner, file }), { path: "p", signedUrl: "u" }),
  uploadedFrom: (fd: FormData) => ({ path: String(fd.get("uploadedPath")), fileName: String(fd.get("fileName") ?? "file") }),
  recordUpload: async (owner: unknown, _up: unknown, _t: unknown, _m: unknown, _title: unknown, nameFor?: (mime: string) => Promise<string>) => {
    state.recorded.push({ owner, name: nameFor ? await nameFor("application/pdf") : "uploader-name.pdf" });
    return { id: "a" };
  },
  removeAttachment: async (row: { id: string }) => void state.removed.push(row.id),
}));
vi.mock("@/db", () => {
  type Chain = { from: () => Chain; innerJoin: () => Chain; where: () => Chain; then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise<unknown> };
  const chain = (result: unknown): Chain => {
    const c: Chain = { from: () => c, innerJoin: () => c, where: () => c, then: (ok, bad) => Promise.resolve(result).then(ok, bad) };
    return c;
  };
  return { db: { select: () => chain(state.selects.shift() ?? []) } };
});

import { uploadAttachment, deleteAttachment } from "./actions";
import { prepareUpload } from "./upload-actions";

const SERVICE = "22222222-2222-4222-8222-222222222222";
const OTHER_SERVICE = "33333333-3333-4333-8333-333333333333";
const serviceRow = { date: "2026-06-14", registrationNumber: "WP BAA-5678", nickname: "Test bike" };
const input = (over: Record<string, unknown> = {}) => ({ purpose: "attachment" as const, ownerType: "vehicle_service", ownerId: SERVICE, fileName: "IMG_0001.heic", mimeType: "application/pdf", size: 1000, ...over });
const person = (...g: [string, string][]) => accessFromGrants(g.map(([area, level]) => ({ area, level })));

beforeEach(() => {
  state.selects = [];
  state.access = { owner: true };
  state.signed = [];
  state.recorded = [];
  state.removed = [];
});

describe("prepareUpload for a file on a service", () => {
  it("is named PLATE_service_date from the service itself, not from the uploader's file name", async () => {
    state.selects = [[serviceRow], []];
    expect(await prepareUpload(input())).toEqual({ ok: true, path: "p", signedUrl: "u" });
    expect(state.signed[0]).toMatchObject({ owner: { ownerType: "vehicle_service", ownerId: SERVICE }, file: { fileName: "BAA-5678_service_2026-06-14.pdf" } });
  });

  it("gets _2 when the service already has an invoice of that name", async () => {
    state.selects = [[serviceRow], [{ fileName: "BAA-5678_service_2026-06-14.pdf" }]];
    await prepareUpload(input());
    expect(state.signed[0].file.fileName).toBe("BAA-5678_service_2026-06-14_2.pdf");
  });

  it("takes the plate from the service's own vehicle, whatever else the request says", async () => {
    state.selects = [[{ ...serviceRow, registrationNumber: "CAB-9999" }], []];
    await prepareUpload(input({ doc: { title: "BAA-5678" }, ownerId: OTHER_SERVICE }));
    expect(state.signed[0].file.fileName).toBe("CAB-9999_service_2026-06-14.pdf");
  });

  it("refuses a service that does not exist, so nothing is attached to a made-up id", async () => {
    state.selects = [[]];
    expect(await prepareUpload(input())).toEqual({ ok: false, error: "That service could not be found." });
    expect(state.signed).toEqual([]);
  });

  it("needs Add in Vehicle documents, not Vehicles", async () => {
    state.access = person(["vehicles", "edit"]);
    state.selects = [[serviceRow], []];
    expect(await prepareUpload(input())).toEqual({ ok: false, error: "Not allowed." });
    state.access = person(["vehicle_documents", "see"]);
    expect(await prepareUpload(input())).toEqual({ ok: false, error: "Not allowed." });
    expect(state.signed).toEqual([]);
    state.access = person(["vehicle_documents", "add"]);
    expect((await prepareUpload(input())).ok).toBe(true);
  });
});

describe("uploadAttachment (recording the file) on a service", () => {
  const form = () => {
    const fd = new FormData();
    fd.set("ownerType", "vehicle_service");
    fd.set("ownerId", SERVICE);
    fd.set("uploadedPath", `vehicle_service/${SERVICE}/11111111-1111-4111-8111-111111111111-x.pdf`);
    fd.set("fileName", "IMG_0001.jpg");
    return fd;
  };

  it("records it under the hub's name, never the uploader's", async () => {
    state.selects = [[serviceRow], []];
    expect(await uploadAttachment({ ok: false }, form())).toEqual({ ok: true });
    expect(state.recorded).toEqual([{ owner: { ownerType: "vehicle_service", ownerId: SERVICE }, name: "BAA-5678_service_2026-06-14.pdf" }]);
  });

  it("is refused without Add in Vehicle documents", async () => {
    state.access = person(["vehicles", "edit"], ["tasks_notes", "edit"]);
    expect(await uploadAttachment({ ok: false }, form())).toEqual({ ok: false, error: "Not allowed." });
    expect(state.recorded).toEqual([]);
  });

  it("is refused for a service that is not there", async () => {
    state.selects = [[]];
    expect((await uploadAttachment({ ok: false }, form())).ok).toBe(false);
  });
});

describe("deleting a service file", () => {
  const form = () => {
    const fd = new FormData();
    fd.set("id", "44444444-4444-4444-8444-444444444444");
    return fd;
  };
  const row = { id: "44444444-4444-4444-8444-444444444444", ownerType: "vehicle_service", ownerId: SERVICE };

  it("needs Edit in Vehicle documents", async () => {
    state.access = person(["vehicles", "edit"], ["vehicle_documents", "add"]);
    state.selects = [[row]];
    await expect(deleteAttachment(form())).rejects.toThrow("Not allowed.");
    expect(state.removed).toEqual([]);
    state.access = person(["vehicle_documents", "edit"]);
    state.selects = [[row]];
    await deleteAttachment(form());
    expect(state.removed).toEqual([row.id]);
  });
});
