import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Where a signed-in stranger becomes "pending" (S.8) and the owners are told (N.4, C142): sign-in is never
 * blocked or slowed by the notice, only a person recorded for the first time triggers it, and nobody who
 * sees the demo can. Real Clerk and Supabase are replaced; the people table is an in-memory Postgres.
 * Made-up addresses only.
 */
vi.mock("server-only", () => ({}));
const clerk = vi.hoisted(() => ({ userId: null as string | null, email: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: clerk.userId, sessionClaims: clerk.email ? { email: clerk.email } : {} }),
  currentUser: async () => null,
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not found"); } }));
const scheduled = vi.hoisted(() => ({ callbacks: [] as (() => Promise<void> | void)[], throwOnSchedule: false }));
vi.mock("next/server", () => ({
  after: (callback: () => Promise<void> | void) => {
    if (scheduled.throwOnSchedule) throw new Error("after() was called outside a request");
    scheduled.callbacks.push(callback);
  },
}));
vi.mock("@/db", async () => {
  const { makeTestDb } = await import("@/test/pglite");
  return { db: (await makeTestDb()).db };
});
const notify = vi.hoisted(() => ({ fn: vi.fn<(db: unknown) => Promise<unknown>>(async () => ({})) }));
vi.mock("@/features/notifications/access-request", () => ({ notifyAccessRequest: notify.fn }));

const { getAuthState, isDemoState } = await import("./auth");
const { db } = await import("@/db");
const { people } = await import("@/db/schema");

process.env.ALLOWED_EMAILS = "owner@example.com";
const STRANGER = "stranger@example.net";

const signIn = (email: string | null) => {
  clerk.userId = email ? "user_test" : null;
  clerk.email = email;
};
const runScheduled = async () => {
  const callbacks = scheduled.callbacks.splice(0);
  for (const callback of callbacks) await callback();
  return callbacks.length;
};

beforeEach(async () => {
  scheduled.callbacks.length = 0;
  scheduled.throwOnSchedule = false;
  vi.restoreAllMocks();
  notify.fn.mockClear();
  notify.fn.mockImplementation(async () => ({}));
  await db.delete(people);
  signIn(null);
}, 60_000);

describe("recording a person who signs in unasked", () => {
  it("records them as pending and tells the owners once, after the response", async () => {
    signIn(STRANGER);
    expect(await getAuthState()).toEqual({ status: "pending", email: STRANGER });
    expect(scheduled.callbacks).toHaveLength(1);
    expect(notify.fn).not.toHaveBeenCalled(); // nothing runs before the response is done
    expect(await runScheduled()).toBe(1);
    expect(notify.fn).toHaveBeenCalledTimes(1);
    // It gets the real database client, not a demo or a handle from the request.
    expect(notify.fn.mock.calls[0][0]).toBe(db);
    expect((await db.select().from(people).where(eq(people.email, STRANGER)))[0].status).toBe("pending");
  });

  it("does not tell the owners again when the same person comes back", async () => {
    signIn(STRANGER);
    await getAuthState();
    await runScheduled();
    for (let i = 0; i < 3; i++) expect(await getAuthState()).toEqual({ status: "pending", email: STRANGER });
    expect(await runScheduled()).toBe(0);
    expect(notify.fn).toHaveBeenCalledTimes(1);
  });

  it("is never triggered for a signed-out visitor, an owner, a blocked person or someone the owner already knows", async () => {
    signIn(null);
    expect((await getAuthState()).status).toBe("signed-out");
    signIn("Owner@Example.com");
    expect((await getAuthState()).status).toBe("ok");
    await db.insert(people).values([
      { email: "blocked@example.net", status: "blocked" },
      { email: "known@example.net", status: "active" },
    ]);
    signIn("blocked@example.net");
    expect((await getAuthState()).status).toBe("not-allowed");
    signIn("known@example.net");
    expect((await getAuthState()).status).toBe("ok");
    expect(await runScheduled()).toBe(0);
    expect(notify.fn).not.toHaveBeenCalled();
  });

  it("someone waiting for approval sees the demo and cannot cause a notice by looking at it", async () => {
    signIn(STRANGER);
    const state = await getAuthState();
    await runScheduled();
    notify.fn.mockClear();
    expect(isDemoState(state)).toBe(true);
    for (let i = 0; i < 5; i++) await getAuthState();
    expect(await runScheduled()).toBe(0);
    expect(notify.fn).not.toHaveBeenCalled();
  });

  it("a failing notice never blocks sign-in, and logs only the error's name", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    notify.fn.mockImplementation(async () => {
      throw new Error(`could not reach ${STRANGER}`);
    });
    signIn(STRANGER);
    expect(await getAuthState()).toEqual({ status: "pending", email: STRANGER });
    await expect(runScheduled()).resolves.toBe(1); // the failure is swallowed
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls.flat().join(" ")).not.toContain(STRANGER);
  });

  it("scheduling the notice failing (outside a request) never blocks sign-in either", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    scheduled.throwOnSchedule = true;
    signIn(STRANGER);
    expect(await getAuthState()).toEqual({ status: "pending", email: STRANGER });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls.flat().join(" ")).not.toContain(STRANGER);
  });
});
