import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/read";
import { appSettings } from "@/db/schema";
import { makeTestDb } from "@/test/pglite";

/**
 * The Settings › Notifications Server Actions (N.2, C141; and N.3's push switch) against an in-memory
 * Postgres. The signed-in owner is faked, Resend is a mocked `fetch`: nothing is sent, nothing real is
 * touched. Everything here is made up (public repo).
 */
const h = vi.hoisted(() => ({ db: null as unknown as Db, email: "testusernotreal0@gmail.com" }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: () => {} }));
vi.mock("@/db", () => ({
  get db() {
    return h.db;
  },
}));
vi.mock("@/lib/auth", () => ({
  AuthError: class AuthError extends Error {},
  requireUser: async () => ({ userId: "user_1", email: h.email, access: { owner: true } }),
}));

const { sendTestEmail, setEmailEnabled } = await import("./email-actions");
const { setPushLive } = await import("./actions");

const KEY = "re_FAKE_test_key_123456";
const TO = "testusernotreal0+tag@gmail.com";

const okFetch = () => vi.fn<typeof fetch>(async () => Response.json({ id: "email_1" }));
const toOf = (f: ReturnType<typeof okFetch>, call = 0) => JSON.parse(String(f.mock.calls[call][1]?.body)).to[0];
const switches = async () => (await h.db.select().from(appSettings).where(eq(appSettings.key, "notifications")))[0]?.value;
const enabled = (on: boolean) => {
  const fd = new FormData();
  fd.set("enabled", String(on));
  return fd;
};

beforeEach(async () => {
  ({ db: h.db } = await makeTestDb());
  h.email = "testusernotreal0@gmail.com";
  vi.stubEnv("RESEND_API_KEY", KEY);
  vi.stubEnv("NOTIFY_EMAIL_TO", TO);
}, 60_000);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sendTestEmail", () => {
  it("sends one, then refuses a second within the minute without calling Resend", async () => {
    const f = okFetch();
    vi.stubGlobal("fetch", f);
    const first = await sendTestEmail();
    expect(first.outcome).toBe("sent");
    expect(first.message).not.toContain(TO);
    const second = await sendTestEmail();
    expect(second.outcome).toBe("not-allowed");
    expect(f).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(f.mock.calls[0][1]?.body)).subject).toBe("hub · Test");
  });

  it("a refused test still uses up the minute", async () => {
    const f = vi.fn<typeof fetch>(async () => Response.json({ name: "validation_error", message: `Invalid ${TO}` }, { status: 422 }));
    vi.stubGlobal("fetch", f);
    const first = await sendTestEmail();
    expect(first.outcome).toBe("refused");
    expect(first.message).not.toMatch(/@/);
    expect((await sendTestEmail()).outcome).toBe("not-allowed");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("goes again once the minute has passed", async () => {
    const f = okFetch();
    vi.stubGlobal("fetch", f);
    await sendTestEmail();
    await h.db.update(appSettings).set({ updatedAt: new Date(Date.now() - 61_000) }).where(eq(appSettings.key, "notifications-email-test"));
    expect((await sendTestEmail()).outcome).toBe("sent");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("sends to the viewer's delivery address", async () => {
    const f = okFetch();
    vi.stubGlobal("fetch", f);
    h.email = "TestUserNotReal0@Gmail.com";
    await sendTestEmail();
    expect(toOf(f)).toBe(TO);

    await h.db.delete(appSettings).where(eq(appSettings.key, "notifications-email-test"));
    h.email = "second@example.com";
    await sendTestEmail();
    expect(toOf(f, 1)).toBe("second@example.com");
  });

  it("without the settings it says so and calls nobody", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const f = okFetch();
    vi.stubGlobal("fetch", f);
    expect((await sendTestEmail()).message).toBe("Email is not set up yet.");
    expect(f).not.toHaveBeenCalled();
  });
});

describe("the two switches never undo each other", () => {
  it("setEmailEnabled keeps an existing push key", async () => {
    await h.db.insert(appSettings).values({ key: "notifications", value: { push: { enabled: true } } });
    expect(await setEmailEnabled(enabled(true))).toEqual({ ok: true });
    expect(await switches()).toEqual({ push: { enabled: true }, email: { enabled: true } });
    expect(await setEmailEnabled(enabled(false))).toEqual({ ok: true });
    expect(await switches()).toEqual({ push: { enabled: true }, email: { enabled: false } });
  });

  it("setPushLive keeps an existing email key", async () => {
    await h.db.insert(appSettings).values({ key: "notifications", value: { email: { enabled: true } } });
    expect(await setPushLive(false)).toEqual({ ok: true });
    expect(await switches()).toEqual({ email: { enabled: true }, push: { enabled: false } });
  });

  it("both flipped at once keep both", async () => {
    await h.db.insert(appSettings).values({ key: "notifications", value: { email: { enabled: false }, push: { enabled: true } } });
    await Promise.all([setEmailEnabled(enabled(true)), setPushLive(false)]);
    expect(await switches()).toEqual({ email: { enabled: true }, push: { enabled: false } });
  });

  it("a saved value that is not an object starts again", async () => {
    await h.db.insert(appSettings).values({ key: "notifications", value: ["broken"] });
    await setEmailEnabled(enabled(true));
    expect(await switches()).toEqual({ email: { enabled: true } });
  });

  it("email cannot be switched on without its settings, but can always be switched off", async () => {
    vi.stubEnv("NOTIFY_EMAIL_TO", "");
    expect(await setEmailEnabled(enabled(true))).toEqual({ ok: false, error: "Email is not set up yet." });
    expect(await setEmailEnabled(enabled(false))).toEqual({ ok: true });
    expect(await setEmailEnabled(new FormData())).toEqual({ ok: false, error: "Could not read the switch." });
  });
});
