import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateVAPIDKeys } from "web-push";
import type { Db } from "@/db/read";
import { accessGrants, appSettings, notifications, people, pushSubscriptions } from "@/db/schema";
import { makeTestDb } from "@/test/pglite";

/**
 * The push Server Actions for any signed-in, allowed person (Notifications N.5, DECISIONS C144),
 * through the REAL `requireUser` and `getAuthState` (only Clerk's session, the database handle and the
 * push service are faked): who may call them, that a device is bound to the caller's verified email, and
 * that nobody can see, remove or test another person's device. The push service is a fake that records
 * the endpoints it was asked to contact; nothing leaves the test. Everything is made up (public repo).
 */
const h = vi.hoisted(() => ({
  db: null as unknown as Db,
  /** The Clerk session: null user = signed out. */
  userId: null as string | null,
  email: "" as string,
  contacted: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: () => {} }));
vi.mock("next/server", () => ({ connection: async () => {}, after: () => {} }));
vi.mock("@/db", () => ({
  get db() {
    return h.db;
  },
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: h.userId, sessionClaims: { email: h.email } }),
  currentUser: async () => null,
}));
vi.mock("./push/transport", () => ({
  webPushTransport: () => async (target: { endpoint: string }) => {
    h.contacted.push(target.endpoint);
    return 201;
  },
}));

const { subscribePush, unsubscribePush, removePushDevice, sendTestPush, setPushLive } = await import("./actions");
const { setEmailEnabled, sendTestEmail } = await import("./email-actions");
const { setPersonNotifications, setPersonStatus, setAccess, removePerson } = await import("@/features/people/actions");
const { endpointHash } = await import("./push/sender");

const OWNER = "owner@example.com";
const ALICE = "alice@example.com";
const BOB = "bob@example.com";
const P256DH = `B${"A".repeat(86)}`;
const AUTH = "abcdefghijklmnopqrstuv";
const ENDPOINT_A = "https://web.push.apple.com/alice-phone";
const ENDPOINT_B = "https://web.push.apple.com/bob-phone";

const sub = (endpoint: string, extra: Record<string, unknown> = {}) => ({ endpoint, expirationTime: null, keys: { p256dh: P256DH, auth: AUTH }, ...extra });
const signIn = (email: string) => {
  h.userId = `user_${email}`;
  h.email = email;
};
const signOut = () => {
  h.userId = null;
  h.email = "";
};
const addPerson = async (email: string, status: "pending" | "active" | "blocked" = "active") => (await h.db.insert(people).values({ email, status }).returning())[0];
const devicesOf = (recipient: string) => h.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.recipient, recipient));
const allDevices = () => h.db.select().from(pushSubscriptions);
const fd = (values: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
};

beforeEach(async () => {
  ({ db: h.db } = await makeTestDb());
  h.contacted = [];
  signOut();
  const keys = generateVAPIDKeys();
  vi.stubEnv("ALLOWED_EMAILS", OWNER);
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", keys.publicKey);
  vi.stubEnv("VAPID_PRIVATE_KEY", keys.privateKey);
  vi.stubEnv("VAPID_SUBJECT", "https://hub.example.com");
  vi.spyOn(console, "error").mockImplementation(() => {});
}, 60_000);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("an active person turns pushes on for their own device", () => {
  beforeEach(async () => {
    await addPerson(ALICE);
    signIn(ALICE);
  });

  it("saves the device bound to their verified email", async () => {
    expect(await subscribePush(sub(ENDPOINT_A), "iPhone")).toEqual({ ok: true });
    const rows = await allDevices();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ recipient: ALICE, endpoint: ENDPOINT_A, deviceLabel: "iPhone" });
  });

  it("never takes the recipient from the client: an extra field is refused, and the signed-in email wins", async () => {
    const res = await subscribePush(sub(ENDPOINT_A, { recipient: BOB }), "iPhone");
    expect(res.ok).toBe(false);
    expect(await allDevices()).toEqual([]);
    // Someone else's email smuggled in as the label is just an unknown label.
    await subscribePush(sub(ENDPOINT_A), BOB);
    expect((await devicesOf(ALICE))[0].deviceLabel).toBe("Browser");
    expect(await devicesOf(BOB)).toEqual([]);
  });

  it("keeps the strict endpoint check (an address that is not a push service is refused)", async () => {
    for (const endpoint of ["https://evil.example.com/x", "http://web.push.apple.com/x", "https://169.254.169.254/x", "https://storage.googleapis.com/b/x"]) {
      expect((await subscribePush(sub(endpoint), "iPhone")).ok).toBe(false);
    }
    expect(await allDevices()).toEqual([]);
  });

  it("allows at most 10 devices per person, and the cap is theirs alone", async () => {
    for (let i = 0; i < 10; i++) expect((await subscribePush(sub(`https://web.push.apple.com/a${i}`), "iPhone")).ok).toBe(true);
    const eleventh = await subscribePush(sub("https://web.push.apple.com/a10"), "iPhone");
    expect(eleventh.ok).toBe(false);
    expect(await devicesOf(ALICE)).toHaveLength(10);
    // Resubscribing a device already in the list is not a new device.
    expect((await subscribePush(sub("https://web.push.apple.com/a3"), "iPhone")).ok).toBe(true);
    // Bob has room.
    await addPerson(BOB);
    signIn(BOB);
    expect((await subscribePush(sub(ENDPOINT_B), "iPhone")).ok).toBe(true);
  });

  it("turns it off again, and only her own", async () => {
    await subscribePush(sub(ENDPOINT_A), "iPhone");
    expect(await unsubscribePush(ENDPOINT_A)).toEqual({ ok: true });
    expect(await allDevices()).toEqual([]);
    expect((await unsubscribePush("")).ok).toBe(false);
    expect((await unsubscribePush(42)).ok).toBe(false);
  });
});

describe("one person can never reach another's device", () => {
  let bobsId: string;
  beforeEach(async () => {
    await addPerson(ALICE);
    await addPerson(BOB);
    signIn(BOB);
    await subscribePush(sub(ENDPOINT_B), "iPhone");
    bobsId = (await devicesOf(BOB))[0].id;
    signIn(ALICE);
  });

  it("an endpoint already owned by Bob is refused for Alice, and Bob's row is untouched", async () => {
    const other = { endpoint: ENDPOINT_B, expirationTime: null, keys: { p256dh: `C${"B".repeat(86)}`, auth: "zzzzzzzzzzzzzzzzzzzzzz" } };
    const res = await subscribePush(other, "Mac");
    expect(res.ok).toBe(false);
    const [row] = await h.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, ENDPOINT_B));
    expect(row).toMatchObject({ recipient: BOB, p256dh: P256DH, auth: AUTH, deviceLabel: "iPhone" });
    expect(await devicesOf(ALICE)).toEqual([]);
  });

  it("Alice cannot turn off Bob's device by its endpoint", async () => {
    expect(await unsubscribePush(ENDPOINT_B)).toEqual({ ok: true });
    expect(await devicesOf(BOB)).toHaveLength(1);
  });

  it("Alice cannot remove Bob's device by its id", async () => {
    expect(await removePushDevice(bobsId)).toEqual({ ok: true });
    expect(await devicesOf(BOB)).toHaveLength(1);
    expect((await removePushDevice("not-an-id")).ok).toBe(false);
    expect((await removePushDevice(undefined)).ok).toBe(false);
  });

  it("Alice cannot send a test to Bob's device with its hash", async () => {
    const res = await sendTestPush(endpointHash(ENDPOINT_B));
    expect(res.ok).toBe(false);
    expect(h.contacted).toEqual([]);
    expect(await h.db.select().from(notifications)).toEqual([]);
  });

  it("with her own device, a test goes to that device only, and Bob's is never contacted", async () => {
    await subscribePush(sub(ENDPOINT_A), "iPhone");
    expect(await sendTestPush(endpointHash(ENDPOINT_A))).toEqual({ ok: true });
    expect(h.contacted).toEqual([ENDPOINT_A]);
    const log = await h.db.select().from(notifications);
    expect(log.map((r) => [r.recipient, r.kind, r.href])).toEqual([[ALICE, "push-test", "/notifications"]]);
  });

  it("one test a minute per person, and Bob's own minute is separate", async () => {
    await subscribePush(sub(ENDPOINT_A), "iPhone");
    expect((await sendTestPush(endpointHash(ENDPOINT_A))).ok).toBe(true);
    expect((await sendTestPush(endpointHash(ENDPOINT_A))).ok).toBe(false);
    expect(h.contacted).toEqual([ENDPOINT_A]);
    signIn(BOB);
    expect((await sendTestPush(endpointHash(ENDPOINT_B))).ok).toBe(true);
  });

  it("refuses a malformed hash", async () => {
    for (const bad of [null, undefined, 5, "", "abc", "G".repeat(64), `${endpointHash(ENDPOINT_B)}0`]) expect((await sendTestPush(bad)).ok).toBe(false);
  });
});

describe("an owner still can, and a test from Settings still opens Settings", () => {
  it("subscribes and tests their own device", async () => {
    signIn(OWNER);
    expect(await subscribePush(sub(ENDPOINT_A), "iPhone")).toEqual({ ok: true });
    expect((await devicesOf(OWNER))[0].recipient).toBe(OWNER);
    expect((await sendTestPush(endpointHash(ENDPOINT_A))).ok).toBe(true);
    expect((await h.db.select().from(notifications))[0].href).toBe("/settings/notifications");
  });

  it("an owner can also switch the hub's pushes", async () => {
    signIn(OWNER);
    expect(await setPushLive(true)).toEqual({ ok: true });
  });
});

describe("who is refused", () => {
  const callAll = async () => [
    await subscribePush(sub(ENDPOINT_A), "iPhone"),
    await unsubscribePush(ENDPOINT_A),
    await removePushDevice("00000000-0000-4000-8000-000000000000"),
    await sendTestPush(endpointHash(ENDPOINT_A)),
  ];

  it("a signed-out visitor (the demo)", async () => {
    signOut();
    for (const res of await callAll()) expect(res.ok).toBe(false);
    expect(await allDevices()).toEqual([]);
  });

  it("a person waiting for approval (they see the demo)", async () => {
    await addPerson(ALICE, "pending");
    signIn(ALICE);
    for (const res of await callAll()) expect(res.ok).toBe(false);
    expect(await allDevices()).toEqual([]);
  });

  it("someone who just signed in and is not known yet (recorded as pending, still refused)", async () => {
    signIn("stranger@example.net");
    for (const res of await callAll()) expect(res.ok).toBe(false);
    expect(await allDevices()).toEqual([]);
    expect((await h.db.select().from(people).where(eq(people.email, "stranger@example.net")))[0].status).toBe("pending");
  });

  it("a blocked person", async () => {
    await addPerson(ALICE);
    signIn(ALICE);
    expect((await subscribePush(sub(ENDPOINT_A), "iPhone")).ok).toBe(true);
    await h.db.update(people).set({ status: "blocked" }).where(eq(people.email, ALICE));
    for (const res of await callAll()) expect(res.ok).toBe(false);
    // Their device stays as it was; they cannot remove or test it, and the run no longer writes to them.
    expect(await devicesOf(ALICE)).toHaveLength(1);
    expect(h.contacted).toEqual([]);
  });

  it("a person whose session has no email", async () => {
    h.userId = "user_x";
    h.email = "";
    for (const res of await callAll()) expect(res.ok).toBe(false);
  });
});

describe("the owner-only switches stay owner-only", () => {
  beforeEach(async () => {
    await addPerson(ALICE);
    signIn(ALICE);
  });

  it("a person cannot switch the hub's pushes or email, or send a test email", async () => {
    expect((await setPushLive(true)).ok).toBe(false);
    expect((await setPushLive(false)).ok).toBe(false);
    expect((await setEmailEnabled(fd({ enabled: "true" }))).ok).toBe(false);
    expect((await sendTestEmail()).outcome).toBe("not-allowed");
    expect(await h.db.select().from(appSettings)).toEqual([]);
  });

  it("a person cannot touch notifications, status or access of anyone, themselves included", async () => {
    const [alice] = await h.db.select().from(people).where(eq(people.email, ALICE));
    await expect(setPersonNotifications(fd({ id: alice.id, enabled: "false" }))).rejects.toThrow();
    await expect(setPersonStatus(fd({ id: alice.id, status: "active" }))).rejects.toThrow();
    expect((await setAccess(fd({ personId: alice.id, area: "bills", level: "edit" }))).ok).toBe(false);
    expect((await h.db.select().from(people).where(eq(people.id, alice.id)))[0].notificationsEnabled).toBe(true);
    expect(await h.db.select().from(accessGrants)).toEqual([]);
  });
});

describe("the device cap holds when subscribes run in parallel", () => {
  it("nine devices and three parallel subscribes leave exactly ten", async () => {
    await addPerson(ALICE);
    signIn(ALICE);
    for (let i = 0; i < 9; i++) expect((await subscribePush(sub(`https://web.push.apple.com/a${i}`), "iPhone")).ok).toBe(true);
    const results = await Promise.all([10, 11, 12].map((i) => subscribePush(sub(`https://web.push.apple.com/a${i}`), "iPhone")));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await devicesOf(ALICE)).toHaveLength(10);
  });

  it("a parallel resubscribe of a device already in the list still works at the cap", async () => {
    await addPerson(ALICE);
    signIn(ALICE);
    for (let i = 0; i < 10; i++) await subscribePush(sub(`https://web.push.apple.com/a${i}`), "iPhone");
    const results = await Promise.all([subscribePush(sub("https://web.push.apple.com/a0"), "Mac"), subscribePush(sub("https://web.push.apple.com/a10"), "iPhone")]);
    expect(results.map((r) => r.ok)).toEqual([true, false]);
    expect(await devicesOf(ALICE)).toHaveLength(10);
  });
});

describe("test pushes are capped per person per day", () => {
  const testRow = (recipient: string, n: number, createdAt: Date, kind = "push-test") =>
    h.db.insert(notifications).values({ recipient, dedupeKey: `${kind}:${n}`, channel: "push", kind, title: "t", body: "b", href: "/", dueDate: "2026-11-23", status: "dry_run", createdAt });

  beforeEach(async () => {
    await addPerson(ALICE);
    await addPerson(BOB);
    signIn(ALICE);
    await subscribePush(sub(ENDPOINT_A), "iPhone");
  });

  it("refuses the eleventh test of the day, without contacting the push service", async () => {
    // Ten earlier tests today (the minute limit only looks at this minute).
    for (let n = 1; n <= 10; n++) await testRow(ALICE, n, new Date(Date.now() - 2 * 60_000));
    const res = await sendTestPush(endpointHash(ENDPOINT_A));
    expect(res.ok).toBe(false);
    expect(h.contacted).toEqual([]);
    expect((await h.db.select().from(notifications)).filter((r) => r.recipient === ALICE)).toHaveLength(10);
  });

  it("allows the tenth, and counts only today's tests, only hers, only of that kind", async () => {
    for (let n = 1; n <= 9; n++) await testRow(ALICE, n, new Date(Date.now() - 2 * 60_000));
    // None of these count: another day, another person, another kind.
    for (let n = 100; n < 110; n++) await testRow(ALICE, n, new Date(Date.now() - 48 * 3_600_000));
    for (let n = 200; n < 210; n++) await testRow(BOB, n, new Date(Date.now() - 2 * 60_000));
    for (let n = 300; n < 310; n++) await testRow(ALICE, n, new Date(Date.now() - 2 * 60_000), "renewal");
    expect(await sendTestPush(endpointHash(ENDPOINT_A))).toEqual({ ok: true });
    expect(h.contacted).toEqual([ENDPOINT_A]);
  });
});

describe("removing or blocking a person unregisters their devices", () => {
  const setup = async () => {
    const alice = await addPerson(ALICE);
    const bob = await addPerson(BOB);
    for (const [email, endpoint] of [
      [ALICE, ENDPOINT_A],
      [ALICE, "https://web.push.apple.com/alice-tablet"],
      [BOB, ENDPOINT_B],
    ]) {
      signIn(email);
      await subscribePush(sub(endpoint), "iPhone");
    }
    signIn(OWNER);
    return { alice, bob };
  };

  it("blocking deletes their devices and no one else's; letting them back in does not bring them back", async () => {
    const { alice } = await setup();
    await setPersonStatus(fd({ id: alice.id, status: "blocked" }));
    expect(await devicesOf(ALICE)).toEqual([]);
    expect(await devicesOf(BOB)).toHaveLength(1);
    await setPersonStatus(fd({ id: alice.id, status: "active" }));
    expect(await devicesOf(ALICE)).toEqual([]);
    // Another account can now use the browser Alice had.
    signIn(BOB);
    expect((await subscribePush(sub(ENDPOINT_A), "iPhone")).ok).toBe(true);
  });

  it("approving or re-activating someone leaves devices alone", async () => {
    const { bob } = await setup();
    await setPersonStatus(fd({ id: bob.id, status: "active" }));
    expect(await devicesOf(BOB)).toHaveLength(1);
  });

  it("removing deletes their devices and the person, and re-adding them starts with none", async () => {
    const { alice, bob } = await setup();
    await removePerson(fd({ id: alice.id }));
    expect(await devicesOf(ALICE)).toEqual([]);
    expect(await h.db.select().from(people).where(eq(people.email, ALICE))).toEqual([]);
    expect(await devicesOf(BOB)).toHaveLength(1);
    expect((await h.db.select().from(people).where(eq(people.id, bob.id))).length).toBe(1);
    await addPerson(ALICE);
    expect(await devicesOf(ALICE)).toEqual([]);
  });

  it("only an owner can do either", async () => {
    const { alice } = await setup();
    signIn(BOB);
    await expect(removePerson(fd({ id: alice.id }))).rejects.toThrow();
    await expect(setPersonStatus(fd({ id: alice.id, status: "blocked" }))).rejects.toThrow();
    expect(await devicesOf(ALICE)).toHaveLength(2);
  });
});

describe("Settings › People shows who has notifications on", () => {
  it("counts a person's live devices and their switch, for the owner only", async () => {
    const { listPeople } = await import("@/features/people/queries");
    await addPerson(ALICE);
    await addPerson(BOB);
    signIn(ALICE);
    await subscribePush(sub(ENDPOINT_A), "iPhone");
    await subscribePush(sub("https://web.push.apple.com/alice-tablet"), "iPad");
    await h.db.update(pushSubscriptions).set({ goneAt: new Date() }).where(eq(pushSubscriptions.endpoint, "https://web.push.apple.com/alice-tablet"));
    await h.db.update(people).set({ notificationsEnabled: false }).where(eq(people.email, BOB));

    // A person cannot read the list (not found), so cannot see anyone's devices.
    await expect(listPeople()).rejects.toThrow();

    signIn(OWNER);
    const list = await listPeople();
    expect(list.map((p) => [p.email, p.devices, p.notificationsEnabled])).toEqual([
      [ALICE, 1, true],
      [BOB, 0, false],
    ]);
  });
});

describe("the owner's switch for a person's notifications", () => {
  it("turns them off and on, and refuses anything else", async () => {
    const alice = await addPerson(ALICE);
    signIn(OWNER);
    await setPersonNotifications(fd({ id: alice.id, enabled: "false" }));
    expect((await h.db.select().from(people).where(eq(people.id, alice.id)))[0].notificationsEnabled).toBe(false);
    await setPersonNotifications(fd({ id: alice.id, enabled: "true" }));
    expect((await h.db.select().from(people).where(eq(people.id, alice.id)))[0].notificationsEnabled).toBe(true);
    await expect(setPersonNotifications(fd({ id: alice.id, enabled: "maybe" }))).rejects.toThrow();
    await expect(setPersonNotifications(fd({ id: "not-an-id", enabled: "false" }))).rejects.toThrow();
    // It touches only that person.
    const bob = await addPerson(BOB);
    await setPersonNotifications(fd({ id: alice.id, enabled: "false" }));
    expect((await h.db.select().from(people).where(and(eq(people.id, bob.id))))[0].notificationsEnabled).toBe(true);
  });
});
