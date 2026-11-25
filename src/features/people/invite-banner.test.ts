import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The sign-up page's welcome line (issue #236, DECISIONS C154): a first name for a valid, unexpired code and
 * nothing else; never an address; unknown, expired, used or malformed codes look like no code at all; the
 * "opened" mark is set once, after the response, and can never break the page.
 */
vi.mock("server-only", () => ({}));
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

const { db } = await import("@/db");
const { people } = await import("@/db/schema");
const { findInvitationBanner, invitationBannerFor, markInvitationOpened } = await import("./invite-banner");

const CODE = "abcdefghijklmnopqrstuv";
const EMAIL = "someone@example.com";
const NOW = new Date("2026-11-24T04:00:00Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);
const add = async (over: Partial<typeof people.$inferInsert> = {}) =>
  db.insert(people).values({ email: EMAIL, status: "invited", inviterName: "Asha", inviteCode: CODE, inviteExpiresAt: later(86_400_000), ...over });
const row = async () => (await db.select().from(people).where(eq(people.email, EMAIL)))[0];
const runScheduled = async () => {
  const callbacks = scheduled.callbacks.splice(0);
  for (const callback of callbacks) await callback();
  return callbacks.length;
};

beforeEach(async () => {
  vi.restoreAllMocks();
  scheduled.callbacks.length = 0;
  scheduled.throwOnSchedule = false;
  await db.delete(people);
}, 60_000);

describe("findInvitationBanner", () => {
  it("answers the inviter's first name for a valid code, and nothing else", async () => {
    await add();
    const banner = await findInvitationBanner(db, CODE, NOW);
    expect(banner).toEqual({ inviterName: "Asha" });
    expect(JSON.stringify(banner)).not.toContain(EMAIL);
  });

  it("answers null for an unknown, malformed, expired, used or withdrawn code, and for non-strings", async () => {
    await add();
    for (const code of ["zzzzzzzzzzzzzzzzzzzzzz", "short", "", `${CODE}x`, "abcdefghijklmnopqrst!!", undefined, null, 42, ["x"], { code: CODE }]) {
      expect(await findInvitationBanner(db, code, NOW)).toBeNull();
    }
    expect(await findInvitationBanner(db, CODE, later(86_400_000))).toBeNull(); // the end moment itself
    expect(await findInvitationBanner(db, CODE, later(2 * 86_400_000))).toBeNull();
    await db.update(people).set({ status: "expired" }).where(eq(people.email, EMAIL));
    expect(await findInvitationBanner(db, CODE, NOW)).toBeNull();
    await db.update(people).set({ status: "active" }).where(eq(people.email, EMAIL));
    expect(await findInvitationBanner(db, CODE, NOW)).toBeNull();
    await db.delete(people);
    expect(await findInvitationBanner(db, CODE, NOW)).toBeNull();
  });

  it("an unknown code and an expired code give the same answer", async () => {
    await add({ inviteExpiresAt: later(-1000) });
    expect(await findInvitationBanner(db, CODE, NOW)).toEqual(await findInvitationBanner(db, "zzzzzzzzzzzzzzzzzzzzzz", NOW));
  });

  it("an invitation with no inviter name still gets a banner (without a name)", async () => {
    await add({ inviterName: null });
    expect(await findInvitationBanner(db, CODE, NOW)).toEqual({ inviterName: null });
  });
});

describe("markInvitationOpened", () => {
  it("sets the opened time once and never moves it", async () => {
    await add();
    await markInvitationOpened(db, CODE, NOW);
    expect((await row()).inviteOpenedAt?.getTime()).toBe(NOW.getTime());
    await markInvitationOpened(db, CODE, later(5000));
    expect((await row()).inviteOpenedAt?.getTime()).toBe(NOW.getTime());
  });

  it("does nothing for an expired invitation, an unknown code or someone already active", async () => {
    await add({ inviteExpiresAt: later(-1) });
    await markInvitationOpened(db, CODE, NOW);
    await markInvitationOpened(db, "zzzzzzzzzzzzzzzzzzzzzz", NOW);
    expect((await row()).inviteOpenedAt).toBeNull();
    await db.update(people).set({ status: "active", inviteExpiresAt: later(1000) }).where(eq(people.email, EMAIL));
    await markInvitationOpened(db, CODE, NOW);
    expect((await row()).inviteOpenedAt).toBeNull();
  });
});

describe("invitationBannerFor (the page's wrapper)", () => {
  it("shows the banner and marks it opened after the response, once", async () => {
    await add({ inviteExpiresAt: new Date(Date.now() + 365 * 86_400_000) });
    expect(await invitationBannerFor(CODE)).toEqual({ inviterName: "Asha" });
    expect((await row()).inviteOpenedAt).toBeNull(); // not before the response
    expect(await runScheduled()).toBe(1);
    const opened = (await row()).inviteOpenedAt;
    expect(opened).not.toBeNull();
    await invitationBannerFor(CODE);
    await runScheduled();
    expect((await row()).inviteOpenedAt?.getTime()).toBe(opened?.getTime());
  });

  it("an unknown or malformed code shows nothing and marks nothing", async () => {
    await add({ inviteExpiresAt: new Date(Date.now() + 365 * 86_400_000) });
    expect(await invitationBannerFor("zzzzzzzzzzzzzzzzzzzzzz")).toBeNull();
    expect(await invitationBannerFor("not a code")).toBeNull();
    expect(await invitationBannerFor(undefined)).toBeNull();
    expect(await runScheduled()).toBe(0);
    expect((await row()).inviteOpenedAt).toBeNull();
  });

  it("never throws into the page, whatever fails, and never logs the code or an address", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await add({ inviteExpiresAt: new Date(Date.now() + 365 * 86_400_000) });
    scheduled.throwOnSchedule = true;
    expect(await invitationBannerFor(CODE)).toBeNull();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls.flat().join(" ")).not.toContain(CODE);
    expect(log.mock.calls.flat().join(" ")).not.toContain(EMAIL);
  });
});
