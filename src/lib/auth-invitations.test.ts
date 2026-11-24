import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Signing in with an invitation (issue #236, DECISIONS C154): an `invited` person has no power until they
 * sign in with the Clerk-verified invited address before it ends; past its end they are an ordinary
 * request; any other address is an ordinary request too. Real Clerk and Supabase are replaced; the people
 * table is an in-memory Postgres. Made-up addresses only. (The older sign-in cases are in auth.test.ts.)
 */
vi.mock("server-only", () => ({}));
type FakeAddress = { emailAddress: string; verification: { status: string } };
const clerk = vi.hoisted(() => ({
  userId: null as string | null,
  email: null as string | null,
  /** Clerk's own record of the account (the check for invitations asks it); null = Clerk has none. */
  user: null as { primaryEmailAddress: FakeAddress | null; emailAddresses: FakeAddress[] } | null,
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: clerk.userId, sessionClaims: clerk.email ? { email: clerk.email } : {} }),
  currentUser: async () => clerk.user,
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not found"); } }));
const scheduled = vi.hoisted(() => ({ callbacks: [] as (() => Promise<void> | void)[] }));
vi.mock("next/server", () => ({ after: (callback: () => Promise<void> | void) => void scheduled.callbacks.push(callback) }));
vi.mock("@/db", async () => {
  const { makeTestDb } = await import("@/test/pglite");
  return { db: (await makeTestDb()).db };
});
const notify = vi.hoisted(() => ({ fn: vi.fn<(db: unknown) => Promise<unknown>>(async () => ({})) }));
vi.mock("@/features/notifications/access-request", () => ({ notifyAccessRequest: notify.fn }));

const { getAuthState } = await import("./auth");
const { db } = await import("@/db");
const { accessGrants, people } = await import("@/db/schema");
const { activateInvitedPerson } = await import("@/features/people/invite-activation");

process.env.ALLOWED_EMAILS = "owner@example.com";
const INVITED = "invited@example.net";
const NOW = new Date("2026-11-24T04:00:00Z");

const signIn = (email: string | null) => {
  clerk.userId = email ? "user_test" : null;
  clerk.email = email;
  clerk.user = null;
};
const verifiedAs = (address: string, status = "verified") => {
  const entry = { emailAddress: address, verification: { status } };
  clerk.user = { primaryEmailAddress: entry, emailAddresses: [entry] };
};
const runScheduled = async () => {
  const callbacks = scheduled.callbacks.splice(0);
  for (const callback of callbacks) await callback();
  return callbacks.length;
};
const invite = async (over: Partial<typeof people.$inferInsert> = {}) => {
  const [row] = await db
    .insert(people)
    .values({
      email: INVITED,
      status: "invited",
      invitedBy: "owner@example.com",
      inviterName: "Asha",
      inviteCode: "abcdefghijklmnopqrstuv",
      inviteSentAt: new Date(NOW.getTime() - 3_600_000),
      inviteExpiresAt: new Date(NOW.getTime() + 86_400_000),
      inviteSendCount: 1,
      ...over,
    })
    .returning();
  await db.insert(accessGrants).values([
    { personId: row.id, area: "vehicles", level: "add" },
    { personId: row.id, area: "bills", level: "see" },
  ]);
  return row;
};
const rowOf = async (email = INVITED) => (await db.select().from(people).where(eq(people.email, email)))[0];

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  scheduled.callbacks.length = 0;
  notify.fn.mockClear();
  await db.delete(people);
  signIn(null);
}, 60_000);
afterEach(() => vi.useRealTimers());

describe("signing in with an invitation", () => {
  it("a verified match becomes active with exactly the stored grants, and nobody is notified", async () => {
    const invited = await invite();
    signIn(INVITED);
    verifiedAs(INVITED);
    expect(await getAuthState()).toEqual({ status: "ok", userId: "user_test", email: INVITED, access: { owner: false, grants: { vehicles: "add", bills: "see" } }, personId: invited.id });
    const row = await rowOf();
    expect(row).toMatchObject({ status: "active", invitedBy: "owner@example.com", inviterName: "Asha", inviteCode: "abcdefghijklmnopqrstuv", inviteSendCount: 1 });
    expect(row.lastSeenAt?.getTime()).toBe(NOW.getTime());
    expect(row.inviteOpenedAt?.getTime()).toBe(NOW.getTime()); // they plainly opened it
    expect(await runScheduled()).toBe(0);
    expect(notify.fn).not.toHaveBeenCalled();
    expect((await getAuthState()).status).toBe("ok"); // their next visit is an active person's
  });

  it("keeps an earlier opened time", async () => {
    const opened = new Date(NOW.getTime() - 5_000_000);
    await invite({ inviteOpenedAt: opened });
    signIn(INVITED);
    verifiedAs(INVITED);
    await getAuthState();
    expect((await rowOf()).inviteOpenedAt?.getTime()).toBe(opened.getTime());
  });

  it("matches the address whatever its case", async () => {
    await invite();
    signIn("Invited@Example.NET");
    verifiedAs("Invited@Example.NET");
    expect((await getAuthState()).status).toBe("ok");
  });

  it("does not activate when Clerk says the address is not verified (session claim path), or cannot say", async () => {
    await invite();
    signIn(INVITED);
    verifiedAs(INVITED, "unverified");
    expect(await getAuthState()).toEqual({ status: "not-allowed", email: null });
    clerk.user = null;
    expect(await getAuthState()).toEqual({ status: "not-allowed", email: null });
    expect((await rowOf()).status).toBe("invited");
  });

  it("does not activate when the account only has a different, verified address", async () => {
    await invite();
    signIn(INVITED);
    verifiedAs("someone-else@example.net");
    expect((await getAuthState()).status).toBe("not-allowed");
    expect((await rowOf()).status).toBe("invited");
  });

  it("does not activate on an unverified primary address (no session claim)", async () => {
    await invite();
    clerk.userId = "user_test";
    verifiedAs(INVITED, "unverified");
    expect(await getAuthState()).toEqual({ status: "not-allowed", email: null });
    expect((await rowOf()).status).toBe("invited");
  });

  it("activates through Clerk's verified primary address when there is no session claim", async () => {
    await invite();
    clerk.userId = "user_test";
    verifiedAs(INVITED);
    expect((await getAuthState()).status).toBe("ok");
  });

  it("the end moment itself is over; a second before it is not", async () => {
    await invite({ inviteExpiresAt: new Date(NOW.getTime() + 1000) });
    signIn(INVITED);
    verifiedAs(INVITED);
    expect((await getAuthState()).status).toBe("ok");

    await db.delete(people);
    scheduled.callbacks.length = 0;
    await invite({ inviteExpiresAt: NOW });
    signIn(INVITED);
    verifiedAs(INVITED);
    expect(await getAuthState()).toEqual({ status: "pending", email: INVITED });
  });

  it("past its end the sign-in is an ordinary request: pending, grants kept, the owners told once", async () => {
    const invited = await invite({ inviteExpiresAt: new Date(NOW.getTime() - 86_400_000), createdAt: new Date("2026-11-01T00:00:00Z") });
    signIn(INVITED);
    verifiedAs(INVITED);
    expect(await getAuthState()).toEqual({ status: "pending", email: INVITED });
    const row = await rowOf();
    expect(row.status).toBe("pending");
    expect(row.createdAt.getTime()).toBe(NOW.getTime()); // the request begins now
    expect(scheduled.callbacks).toHaveLength(1);
    expect(await runScheduled()).toBe(1);
    expect(notify.fn).toHaveBeenCalledTimes(1);
    expect(notify.fn.mock.calls[0][0]).toBe(db);
    expect(await db.select().from(accessGrants).where(eq(accessGrants.personId, invited.id))).toHaveLength(2);

    for (let i = 0; i < 3; i++) expect((await getAuthState()).status).toBe("pending");
    expect(await runScheduled()).toBe(0);

    // The owner approves (setPersonStatus does exactly this): the stored grants apply at once.
    await db.update(people).set({ status: "active" }).where(eq(people.id, invited.id));
    expect(await getAuthState()).toMatchObject({ status: "ok", access: { owner: false, grants: { vehicles: "add", bills: "see" } } });
  });

  it("an expired person is a new request on their next sign-in, announced once", async () => {
    await invite({ status: "expired" });
    signIn(INVITED);
    verifiedAs(INVITED);
    expect((await getAuthState()).status).toBe("pending");
    expect((await rowOf()).status).toBe("pending");
    expect(await runScheduled()).toBe(1);
    for (let i = 0; i < 3; i++) await getAuthState();
    expect(await runScheduled()).toBe(0);
  });

  it("two tabs signing in together activate once", async () => {
    await invite();
    signIn(INVITED);
    verifiedAs(INVITED);
    const states = await Promise.all([getAuthState(), getAuthState(), getAuthState()]);
    expect(states.map((s) => s.status)).toEqual(["ok", "ok", "ok"]);
    expect((await rowOf()).status).toBe("active");
    expect(await runScheduled()).toBe(0);
  });

  it("two tabs signing in together after the end announce once", async () => {
    await invite({ inviteExpiresAt: new Date(NOW.getTime() - 1000) });
    signIn(INVITED);
    verifiedAs(INVITED);
    const states = await Promise.all([getAuthState(), getAuthState(), getAuthState()]);
    expect(states.map((s) => s.status)).toEqual(["pending", "pending", "pending"]);
    expect(await runScheduled()).toBe(1);
    expect(notify.fn).toHaveBeenCalledTimes(1);
  });

  it("a different address changes nothing about the invitation: it is an ordinary new request", async () => {
    const invited = await invite();
    signIn("other@example.net");
    verifiedAs("other@example.net");
    expect(await getAuthState()).toEqual({ status: "pending", email: "other@example.net" });
    expect(await runScheduled()).toBe(1);
    expect(await rowOf()).toMatchObject({ id: invited.id, status: "invited", lastSeenAt: null });
    expect((await rowOf("other@example.net")).status).toBe("pending");
  });

  it("an invited person is nobody while signed out", async () => {
    await invite();
    signIn(null);
    expect((await getAuthState()).status).toBe("signed-out");
    expect((await rowOf()).status).toBe("invited");
  });
});

describe("activateInvitedPerson", () => {
  it("exactly one of several simultaneous calls activates", async () => {
    await invite();
    const results = await Promise.all(Array.from({ length: 5 }, () => activateInvitedPerson(db, INVITED, NOW)));
    expect(results.filter((r) => r.result === "activated")).toHaveLength(1);
    expect(results.filter((r) => r.result === "none")).toHaveLength(4);
  });

  it("an invitation without an end date can never activate", async () => {
    await invite({ inviteExpiresAt: null });
    expect((await activateInvitedPerson(db, INVITED, NOW)).result).toBe("expired");
    expect((await rowOf()).status).toBe("expired");
  });

  it("never touches pending, active, blocked or expired people", async () => {
    await db.insert(people).values(["pending", "active", "blocked", "expired"].map((status) => ({ email: `${status}@example.net`, status: status as "pending" })));
    for (const status of ["pending", "active", "blocked", "expired"]) {
      expect((await activateInvitedPerson(db, `${status}@example.net`, NOW)).result).toBe("none");
      expect((await rowOf(`${status}@example.net`)).status).toBe(status);
    }
  });
});
