import { beforeEach, describe, expect, it, vi } from "vitest";
import { AREAS, accessFromGrants, type Access } from "@/features/people/access";

/**
 * Opening a cheque's photo through /files/<id> (issue #178, C158): owners only. A shared person who has every
 * section at Edit (the strongest non-owner there is, including Tasks & notes, where a file of an unknown
 * owner type would fall), the demo and a signed-out visitor never get a link, and one cheque's photo is
 * opened only by its own id.
 */

const state = vi.hoisted(() => ({
  auth: { status: "ok", access: { owner: true } } as { status: string; access?: unknown },
  attachments: {} as Record<string, Record<string, unknown>>,
  signed: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db/read", () => ({ readDb: async () => ({}) }));
vi.mock("@/lib/auth", () => ({ getAuthState: async () => state.auth }));
vi.mock("@/features/shared/queries", () => ({ getAttachment: async (id: string) => state.attachments[id] ?? null }));
vi.mock("@/lib/storage", () => ({
  storageClient: () => ({
    storage: { from: () => ({ createSignedUrl: async (path: string) => (state.signed.push(path), { data: { signedUrl: "https://storage.example/signed" }, error: null }) }) },
  }),
}));

import { GET } from "./[id]/route";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const photo = (id: string, chequeId: string) => ({ id, ownerType: "cheque", ownerId: chequeId, bucket: "attachments", storagePath: `cheque/${chequeId}/${id}-x.jpg`, fileName: "cheque_2026-12-10_1.jpg" });
const call = (id: string) => GET(new Request(`http://localhost/files/${id}`), { params: Promise.resolve({ id }) } as never);
const everything: Access = accessFromGrants(AREAS.map((a) => ({ area: a.key, level: "edit" })));

beforeEach(() => {
  state.auth = { status: "ok", access: { owner: true } };
  state.attachments = { [A]: photo(A, "11111111-1111-4111-8111-111111111111"), [B]: photo(B, "22222222-2222-4222-8222-222222222222") };
  state.signed = [];
});

describe("GET /files/<id> for a cheque's photo", () => {
  it("opens for an owner, each photo by its own id and path", async () => {
    const res = await call(A);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://storage.example/signed");
    await call(B);
    expect(state.signed).toEqual([`cheque/11111111-1111-4111-8111-111111111111/${A}-x.jpg`, `cheque/22222222-2222-4222-8222-222222222222/${B}-x.jpg`]);
  });

  it("answers not found to a shared person with every section at Edit, and signs nothing", async () => {
    state.auth = { status: "ok", access: everything };
    expect((await call(A)).status).toBe(404);
    expect((await call(B)).status).toBe(404);
    expect(state.signed).toEqual([]);
  });

  it("answers not found to a person with no sections", async () => {
    state.auth = { status: "ok", access: accessFromGrants([]) };
    expect((await call(A)).status).toBe(404);
  });

  it("is not allowed for the demo or a signed-out visitor", async () => {
    for (const status of ["signed-out", "pending"]) {
      state.auth = { status };
      expect((await call(A)).status).toBe(403);
    }
    expect(state.signed).toEqual([]);
  });

  it("answers not found for a photo that does not exist, and for something that is not an id", async () => {
    expect((await call("cccccccc-cccc-4ccc-8ccc-cccccccccccc")).status).toBe(404);
    expect((await call("../etc")).status).toBe(404);
  });
});
