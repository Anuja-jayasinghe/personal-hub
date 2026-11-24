import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { accessGrants, people, pushSubscriptions } from "@/db/schema";
import { loadAccessRequestEvents } from "@/features/reminders/sources/access-requests";
import { loadPersonRecipients } from "@/features/notifications/person-recipients";
import { personRecipient } from "@/features/notifications/recipients";

/**
 * An invited or expired person has NO power anywhere (issue #236, DECISIONS C154): no access, no
 * notifications, no pushes, never an "access request", until the sign-in check makes them active. Each
 * place that reads people is checked here against an in-memory Postgres. Made-up data only.
 * (Sign-in itself is in src/lib/auth-invitations.test.ts.)
 */
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/cache", () => ({ refresh: () => {} }));
const auth = vi.hoisted(() => ({ requireUser: vi.fn(async () => ({ userId: "u", email: "owner@example.com", access: { owner: true } })) }));
vi.mock("@/lib/auth", () => ({ requireUser: auth.requireUser, AuthError: class extends Error {}, getFirstName: async () => "Asha" }));
vi.mock("@/db", async () => {
  const { makeTestDb } = await import("@/test/pglite");
  return { db: (await makeTestDb()).db };
});

const { db } = await import("@/db");
const { setAccess, setPersonStatus } = await import("./actions");

const P256DH = `B${"A".repeat(86)}`;
const AUTH = "abcdefghijklmnopqrstuv";
const TODAY = "2026-11-24";
const NOW = new Date("2026-11-24T04:00:00Z");
const OWNERS = new Set(["owner@example.com"]);

beforeEach(async () => {
  await db.delete(people);
  await db.delete(pushSubscriptions);
}, 60_000);

/** One person in each state, each with a grant and a live push device: only the active one may be written to. */
async function everyone() {
  const rows = await db
    .insert(people)
    .values((["pending", "active", "blocked", "invited", "expired"] as const).map((status) => ({ email: `${status}@example.com`, status, createdAt: NOW, inviteExpiresAt: new Date(NOW.getTime() + 86_400_000) })))
    .returning();
  await db.insert(accessGrants).values(rows.map((r) => ({ personId: r.id, area: "vehicles", level: "see" as const })));
  await db.insert(pushSubscriptions).values(rows.map((r) => ({ recipient: r.email, endpoint: `https://push.example.test/${r.status}`, p256dh: P256DH, auth: AUTH, deviceLabel: "iPhone" })));
  return rows;
}

describe("an invited or expired person hears nothing and is never an access request", () => {
  it("is not a recipient of the daily run, even with a device and a grant", async () => {
    await everyone();
    const recipients = await loadPersonRecipients(db, OWNERS);
    expect(recipients.map((r) => r.email)).toEqual(["active@example.com"]);
  });

  it("is not a recipient when asked directly", () => {
    for (const status of ["invited", "expired", "pending", "blocked"]) {
      expect(personRecipient({ email: `${status}@example.com`, status, notificationsEnabled: true, grants: [{ area: "vehicles", level: "see" }] }, OWNERS)).toBeNull();
    }
  });

  it("is not a sign-up request for the owners' push, while a real pending person is", async () => {
    await everyone();
    const events = await loadAccessRequestEvents(db, TODAY);
    expect(events).toHaveLength(1);
    const pending = (await db.select().from(people).where(eq(people.status, "pending")))[0];
    expect(events[0].key).toBe(`access-request:${pending.id}`);
  });
});

describe("the owner's actions on a waiting invitation", () => {
  it("Access works for an invited person like for anyone", async () => {
    const [p] = await db.insert(people).values({ email: "invited@example.com", status: "invited" }).returning();
    const fd = new FormData();
    fd.set("personId", p.id);
    fd.set("area", "bills");
    fd.set("level", "add");
    expect(await setAccess(fd)).toEqual({ ok: true });
    expect((await db.select().from(accessGrants).where(eq(accessGrants.personId, p.id))).map((g) => `${g.area}:${g.level}`)).toEqual(["bills:add"]);
    fd.set("level", "hidden");
    expect(await setAccess(fd)).toEqual({ ok: true });
    expect(await db.select().from(accessGrants).where(eq(accessGrants.personId, p.id))).toHaveLength(0);
  });

  it("approving an expired person's request uses the grants stored with the invitation", async () => {
    const [p] = await db.insert(people).values({ email: "expired@example.com", status: "pending" }).returning();
    await db.insert(accessGrants).values({ personId: p.id, area: "vehicles", level: "add" });
    const fd = new FormData();
    fd.set("id", p.id);
    fd.set("status", "active");
    await setPersonStatus(fd);
    expect((await db.select().from(people).where(eq(people.id, p.id)))[0].status).toBe("active");
    const recipients = await loadPersonRecipients(db, OWNERS);
    expect(recipients).toEqual([]); // no device yet: still nothing to send, but the person is now a candidate
    expect((await db.select().from(accessGrants).where(eq(accessGrants.personId, p.id)))[0].level).toBe("add");
  });
});
