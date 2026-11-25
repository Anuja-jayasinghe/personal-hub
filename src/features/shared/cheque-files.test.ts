import { beforeEach, describe, expect, it, vi } from "vitest";
import { AREAS, accessFromGrants, type Access } from "@/features/people/access";

/**
 * Photos on a cheque (issue #178, C158): adding, naming and deleting are owners only (no section opens them,
 * not even Tasks & notes, where an unknown owner type would otherwise fall), the name is made by the hub
 * from the cheque itself (never from the request or the uploader), a cheque keeps two photos, and a cheque
 * that does not exist cannot be attached to. The database, storage and the access check are fakes; the
 * access check is the real `allows` over a chosen person.
 */

const state = vi.hoisted(() => ({
  selects: [] as unknown[][],
  access: null as unknown as Access,
  signed: [] as { owner: unknown; file: { fileName: string } }[],
  recorded: [] as { owner: unknown; name: string }[],
  removed: [] as string[],
  tasks: [] as unknown[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: () => {} }));
vi.mock("@/lib/auth", async () => {
  const { ValidationError } = await import("@/features/shared/validation");
  const { allows: can } = await import("@/features/people/access");
  return {
    requireUser: async (need: unknown) => {
      if (need === "signed-in") return {};
      if (need === "owner") {
        if (!state.access.owner) throw new ValidationError("Not allowed.");
        return {};
      }
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
    state.recorded.push({ owner, name: nameFor ? await nameFor("image/jpeg") : "uploader-name.jpg" });
    return { id: "a" };
  },
  removeAttachment: async (row: { id: string }) => void state.removed.push(row.id),
}));
vi.mock("@/db", () => {
  type Chain = { from: () => Chain; innerJoin: () => Chain; where: () => Chain; values: (v: unknown) => Chain; returning: () => Chain; then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise<unknown> };
  const chain = (result: unknown): Chain => {
    const c: Chain = { from: () => c, innerJoin: () => c, where: () => c, values: (v) => (state.tasks.push(v), c), returning: () => c, then: (ok, bad) => Promise.resolve(result).then(ok, bad) };
    return c;
  };
  return { db: { select: () => chain(state.selects.shift() ?? []), insert: () => chain([{ id: "t" }]) } };
});

import { createNote, createTask, deleteAttachment, uploadAttachment } from "./actions";
import { prepareUpload } from "./upload-actions";

const CHEQUE = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const chequeRow = { date: "2026-12-10" };
const input = (over: Record<string, unknown> = {}) => ({ purpose: "attachment" as const, ownerType: "cheque", ownerId: CHEQUE, fileName: "IMG_0001.heic", mimeType: "image/jpeg", size: 1000, ...over });
const everything: Access = accessFromGrants(AREAS.map((a) => ({ area: a.key, level: "edit" })));

beforeEach(() => {
  state.selects = [];
  state.access = { owner: true };
  state.signed = [];
  state.recorded = [];
  state.removed = [];
  state.tasks = [];
});

describe("prepareUpload for a cheque photo", () => {
  it("is named cheque_<date>_<n> from the cheque itself, not from the uploader's file name", async () => {
    state.selects = [[chequeRow], []];
    expect(await prepareUpload(input())).toEqual({ ok: true, path: "p", signedUrl: "u" });
    expect(state.signed[0]).toMatchObject({ owner: { ownerType: "cheque", ownerId: CHEQUE }, file: { fileName: "cheque_2026-12-10_1.jpg" } });
  });

  it("the back gets _2, and a deleted front's number is used again", async () => {
    state.selects = [[chequeRow], [{ fileName: "cheque_2026-12-10_1.jpg" }]];
    await prepareUpload(input({ mimeType: "application/pdf" }));
    expect(state.signed[0].file.fileName).toBe("cheque_2026-12-10_2.pdf");
    state.selects = [[chequeRow], [{ fileName: "cheque_2026-12-10_2.jpg" }]];
    await prepareUpload(input());
    expect(state.signed[1].file.fileName).toBe("cheque_2026-12-10_1.jpg");
  });

  it("refuses a third photo", async () => {
    state.selects = [[chequeRow], [{ fileName: "cheque_2026-12-10_1.jpg" }, { fileName: "cheque_2026-12-10_2.jpg" }]];
    expect(await prepareUpload(input())).toEqual({ ok: false, error: "A cheque keeps a front and a back photo. Delete one to add another." });
    expect(state.signed).toEqual([]);
  });

  it("refuses a cheque that does not exist, so nothing is attached to a made-up id", async () => {
    state.selects = [[]];
    expect(await prepareUpload(input({ ownerId: OTHER }))).toEqual({ ok: false, error: "That cheque could not be found." });
    expect(state.signed).toEqual([]);
  });

  it("takes the date from the cheque in the request's owner id, one cheque never names another's photo", async () => {
    state.selects = [[{ date: "2027-01-05" }], []];
    await prepareUpload(input({ ownerId: OTHER }));
    expect(state.signed[0]).toMatchObject({ owner: { ownerId: OTHER }, file: { fileName: "cheque_2027-01-05_1.jpg" } });
  });

  it("is refused to everyone but the owner, even with every section at Edit, and signs nothing", async () => {
    state.access = everything;
    state.selects = [[chequeRow], []];
    expect(await prepareUpload(input())).toEqual({ ok: false, error: "Not allowed." });
    expect(state.signed).toEqual([]);
  });
});

describe("uploadAttachment (recording the photo) on a cheque", () => {
  const form = (ownerId = CHEQUE) => {
    const fd = new FormData();
    fd.set("ownerType", "cheque");
    fd.set("ownerId", ownerId);
    fd.set("uploadedPath", `cheque/${ownerId}/11111111-1111-4111-8111-111111111111-x.jpg`);
    fd.set("fileName", "IMG_0001.jpg");
    return fd;
  };

  it("records it under the hub's name, never the uploader's", async () => {
    state.selects = [[chequeRow], []];
    expect(await uploadAttachment({ ok: false }, form())).toEqual({ ok: true });
    expect(state.recorded).toEqual([{ owner: { ownerType: "cheque", ownerId: CHEQUE }, name: "cheque_2026-12-10_1.jpg" }]);
  });

  it("is refused to everyone but the owner", async () => {
    state.access = everything;
    expect(await uploadAttachment({ ok: false }, form())).toEqual({ ok: false, error: "Not allowed." });
    expect(state.recorded).toEqual([]);
  });

  it("is refused for a cheque that is not there", async () => {
    state.selects = [[]];
    expect((await uploadAttachment({ ok: false }, form(OTHER))).ok).toBe(false);
    expect(state.recorded).toEqual([]);
  });
});

describe("deleting a cheque photo", () => {
  const form = () => {
    const fd = new FormData();
    fd.set("id", "44444444-4444-4444-8444-444444444444");
    return fd;
  };
  const row = { id: "44444444-4444-4444-8444-444444444444", ownerType: "cheque", ownerId: CHEQUE };

  it("is for the owner alone", async () => {
    state.access = everything;
    state.selects = [[row]];
    await expect(deleteAttachment(form())).rejects.toThrow("Not allowed.");
    expect(state.removed).toEqual([]);
    state.access = { owner: true };
    state.selects = [[row]];
    await deleteAttachment(form());
    expect(state.removed).toEqual([row.id]);
  });
});

describe("tasks and notes on a cheque", () => {
  it("cannot be added by anyone but the owner, even with Tasks & notes at Edit", async () => {
    state.access = everything;
    const task = new FormData();
    task.set("title", "A task");
    task.set("priority", "normal");
    task.set("ownerType", "cheque");
    task.set("ownerId", CHEQUE);
    expect(await createTask({ ok: false }, task)).toEqual({ ok: false, error: "Not allowed." });
    const note = new FormData();
    note.set("title", "A note");
    note.set("body", "text");
    note.set("ownerType", "cheque");
    note.set("ownerId", CHEQUE);
    expect(await createNote({ ok: false }, note)).toEqual({ ok: false, error: "Not allowed." });
    expect(state.tasks).toEqual([]);
  });
});
