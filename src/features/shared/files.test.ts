import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * recordUpload must never delete a stored object that a saved file uses (review of PR #199): the browser
 * says which path it uploaded to, so a path that already belongs to an attachment (a cover photo, the file
 * being replaced, a second submit) must be refused and left alone. The database and storage are fakes here.
 */

const state = vi.hoisted(() => ({
  selects: [] as unknown[][],
  insertError: null as unknown,
  inserted: 0,
  removed: [] as string[],
  info: { size: 1000, contentType: "application/pdf" } as { size: number; contentType: string },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => {
  type Chain = { from: () => Chain; where: () => Chain; limit: () => Chain; then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise<unknown> };
  const chain = (result: unknown): Chain => {
    const c: Chain = { from: () => c, where: () => c, limit: () => c, then: (ok, bad) => Promise.resolve(result).then(ok, bad) };
    return c;
  };
  return {
    db: {
      select: () => chain(state.selects.shift() ?? []),
      insert: () => ({
        values: () => ({
          returning: async () => {
            state.inserted++;
            if (state.insertError) throw state.insertError;
            return [{ id: "new-row" }];
          },
        }),
      }),
    },
  };
});
vi.mock("@/lib/storage", () => ({
  ATTACHMENT_BUCKET: "attachments",
  MAX_ATTACHMENT_BYTES: 10 * 1024 * 1024,
  ALLOWED_ATTACHMENT_TYPES: ["application/pdf", "image/jpeg"],
  storageClient: () => ({
    storage: {
      from: () => ({
        info: async () => ({ data: state.info, error: null }),
        remove: async (paths: string[]) => {
          state.removed.push(...paths);
          return { error: null };
        },
      }),
    },
  }),
}));

import { isUniqueViolation, recordUpload } from "./files";
import { ValidationError } from "./validation";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const owner = { ownerType: "vehicle" as const, ownerId: OWNER_ID };
const path = `vehicle/${OWNER_ID}/22222222-2222-4222-8222-222222222222-scan.pdf`;

beforeEach(() => {
  state.selects = [];
  state.insertError = null;
  state.inserted = 0;
  state.removed = [];
  state.info = { size: 1000, contentType: "application/pdf" };
});

describe("recordUpload", () => {
  it("records a new upload", async () => {
    state.selects = [[]];
    await expect(recordUpload(owner, { path, fileName: "scan.pdf" })).resolves.toEqual({ id: "new-row" });
    expect(state.removed).toEqual([]);
  });

  it("refuses a path a saved file already uses, and deletes nothing", async () => {
    state.selects = [[{ id: "cover-photo" }]];
    await expect(recordUpload(owner, { path, fileName: "scan.pdf" })).rejects.toBeInstanceOf(ValidationError);
    expect(state.inserted).toBe(0);
    expect(state.removed).toEqual([]);
  });

  it("leaves the object alone when the insert hits a duplicate path (23505)", async () => {
    state.selects = [[], []];
    state.insertError = Object.assign(new Error("insert failed"), { cause: { code: "23505" } });
    await expect(recordUpload(owner, { path, fileName: "scan.pdf" })).rejects.toBeInstanceOf(ValidationError);
    expect(state.removed).toEqual([]);
  });

  it("removes its own new object when the insert fails for another reason", async () => {
    state.selects = [[], []];
    state.insertError = new Error("connection lost");
    await expect(recordUpload(owner, { path, fileName: "scan.pdf" })).rejects.toThrow("connection lost");
    expect(state.removed).toEqual([path]);
  });

  it("does not remove the object if a row points at it by the time it fails", async () => {
    state.selects = [[], [{ id: "someone-else" }]];
    state.insertError = new Error("connection lost");
    await expect(recordUpload(owner, { path, fileName: "scan.pdf" })).rejects.toThrow("connection lost");
    expect(state.removed).toEqual([]);
  });

  it("removes a refused file type that nothing uses", async () => {
    state.selects = [[], []];
    state.info = { size: 1000, contentType: "text/plain" };
    await expect(recordUpload(owner, { path, fileName: "scan.txt" })).rejects.toBeInstanceOf(ValidationError);
    expect(state.inserted).toBe(0);
    expect(state.removed).toEqual([path]);
  });

  it("refuses a path outside the record's folder before touching storage", async () => {
    await expect(recordUpload(owner, { path: `vehicle/${OWNER_ID}/../other`, fileName: "x" })).rejects.toBeInstanceOf(ValidationError);
    expect(state.removed).toEqual([]);
  });
});

describe("isUniqueViolation", () => {
  it("finds 23505 on the error or its causes", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation(Object.assign(new Error("x"), { cause: { code: "23505" } }))).toBe(true);
    expect(isUniqueViolation(new Error("x"))).toBe(false);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
  });
});
