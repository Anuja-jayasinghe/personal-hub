import { beforeEach, describe, expect, it, vi } from "vitest";
import { accessFromGrants, type Access } from "@/features/people/access";

/**
 * Opening a file on a service through /files/<id> (V.1a, C147): the link needs the Vehicle documents section
 * (to see), exactly like a renewal's file; seeing the service records in Vehicles is not enough, and someone
 * not signed in gets nothing.
 */

const state = vi.hoisted(() => ({
  auth: { status: "ok", access: { owner: true } } as { status: string; access?: unknown },
  attachment: null as null | Record<string, unknown>,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db/read", () => ({ readDb: async () => ({}) }));
vi.mock("@/lib/auth", () => ({ getAuthState: async () => state.auth }));
vi.mock("@/features/shared/queries", () => ({ getAttachment: async () => state.attachment }));
vi.mock("@/lib/storage", () => ({
  storageClient: () => ({ storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: "https://storage.example/signed" }, error: null }) }) } }),
}));

import { GET } from "./[id]/route";

const ID = "44444444-4444-4444-8444-444444444444";
const SERVICE_FILE = { id: ID, ownerType: "vehicle_service", ownerId: "22222222-2222-4222-8222-222222222222", bucket: "attachments", storagePath: "vehicle_service/x/y.pdf", fileName: "ABC-1234_service_2026-06-14.pdf" };
const call = () => GET(new Request(`http://localhost/files/${ID}`), { params: Promise.resolve({ id: ID }) } as never);
const person = (...g: [string, string][]): Access => accessFromGrants(g.map(([area, level]) => ({ area, level })));

beforeEach(() => {
  state.auth = { status: "ok", access: { owner: true } };
  state.attachment = SERVICE_FILE;
});

describe("GET /files/<id> for a service's invoice", () => {
  it("opens for an owner and for Vehicle documents at See", async () => {
    expect((await call()).status).toBe(302);
    state.auth = { status: "ok", access: person(["vehicle_documents", "see"]) };
    const res = await call();
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://storage.example/signed");
  });

  it("answers not found to someone who may see the services but not Vehicle documents", async () => {
    state.auth = { status: "ok", access: person(["vehicles", "edit"], ["tasks_notes", "edit"]) };
    expect((await call()).status).toBe(404);
    state.auth = { status: "ok", access: person() };
    expect((await call()).status).toBe(404);
  });

  it("is not allowed when nobody is signed in", async () => {
    state.auth = { status: "signed-out" };
    expect((await call()).status).toBe(403);
  });

  it("answers not found for a file that does not exist", async () => {
    state.attachment = null;
    expect((await call()).status).toBe(404);
  });
});
