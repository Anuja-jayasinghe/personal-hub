import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/read";
import { appSettings, notifications, pushSubscriptions } from "@/db/schema";
import type { ReminderItem, ReminderSource } from "@/features/reminders/engine";
import { addDays } from "@/lib/dates";
import { makeTestDb } from "@/test/pglite";

/**
 * Switching email on (N.2, C141) against an in-memory Postgres; Resend is a mocked `fetch`, nothing is
 * sent. N.1's switch makes the old dry-run rows stop counting, so every plan-ahead notice still inside
 * its window becomes due at once: batching must turn that into ONE email per recipient that day.
 * Everything here is made up (public repo).
 */
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/db/read", () => ({
  readDb: async () => {
    throw new Error("readDb must not be used by the daily run");
  },
}));

const { runDaily } = await import("./daily");
const { SENDERS } = await import("./channels");
const { emailSender, noticeIdempotencyKey } = await import("./email");
const { buildSenders } = await import("./senders");

const TODAY = "2026-11-23";
const at = (day: string) => new Date(`${day}T02:10:00Z`); // 07:40 in Colombo
const OWNER = "testusernotreal0@gmail.com";
const SECOND = "second@example.com";
const ENV = { RESEND_API_KEY: "re_FAKE_test_key_123456", NOTIFY_EMAIL_TO: "testusernotreal0+tag@gmail.com" };

/** Several items whose email windows opened on different days before TODAY. */
const ITEMS: ReminderItem[] = [
  { id: "renewal:r1", title: "Insurance · Silver car", dueDate: addDays(TODAY, 20), href: "/vehicles/v1?item=renewal:r1", kind: "renewal", notice: { what: "Insurance", who: "Silver car" } },
  { id: "renewal:r2", title: "Revenue license · Blue bike", dueDate: addDays(TODAY, 28), href: "/vehicles/v2?item=renewal:r2", kind: "renewal", notice: { what: "Revenue license", who: "Blue bike" } },
  { id: "service:s1", title: "Full service · Silver car", dueDate: addDays(TODAY, 9), href: "/vehicles/v1?item=service:s1", kind: "service", notice: { what: "Full service", who: "Silver car" } },
  { id: "electricity-bill:e1", title: "Electricity bill · LKR 4,250.00", dueDate: addDays(TODAY, 5), href: "/bills#electricity-bill-e1", kind: "bill", notice: { what: "Electricity bill", who: "Main house" } },
];
const source: ReminderSource = { key: "vehicles", label: "Vehicles", load: async () => ITEMS };

let db: Db;
let client: Awaited<ReturnType<typeof makeTestDb>>["client"];
beforeEach(async () => {
  ({ db, client } = await makeTestDb());
}, 60_000);

const switchEmail = (enabled: boolean) =>
  db
    .insert(appSettings)
    .values({ key: "notifications", value: { email: { enabled } } })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: { email: { enabled } } } });

function liveSenders() {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ id: "email_1" }));
  return { fetch, senders: { ...SENDERS, email: emailSender(() => ENV, { fetch }) } };
}
const recipientsOf = (fetch: ReturnType<typeof liveSenders>["fetch"]) => fetch.mock.calls.map((c) => JSON.parse(String(c[1]?.body)).to[0]);

describe("switching email on", () => {
  it("after ten days of dry runs, the first live day sends ONE batched email per recipient", async () => {
    const allowedEmails = `${OWNER}, ${SECOND}`;
    // Ten mornings with email off: everything is logged as a dry run.
    const { fetch, senders } = liveSenders();
    for (let d = -10; d < 0; d++) await runDaily({ db, now: at(addDays(TODAY, d)), allowedEmails, sources: [source], senders });
    expect(fetch).not.toHaveBeenCalled();
    const dry = await db.select().from(notifications).where(sql`${notifications.channel} = 'email'`);
    expect(dry.length).toBeGreaterThan(2);
    expect(dry.every((r) => r.status === "dry_run")).toBe(true);

    await switchEmail(true);
    const report = await runDaily({ db, now: at(TODAY), allowedEmails, sources: [source], senders });
    expect(report.modes.email).toBe("live");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(recipientsOf(fetch).sort()).toEqual([SECOND, "testusernotreal0+tag@gmail.com"]);
    expect(report.messages.email).toBe(2);
    const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(body.subject).toBe("hub · 4 things coming up");

    // Later the same day, and the next morning: nothing new, nothing sent.
    await runDaily({ db, now: new Date(at(TODAY).getTime() + 3_600_000), allowedEmails, sources: [source], senders });
    await runDaily({ db, now: at(addDays(TODAY, 1)), allowedEmails, sources: [source], senders });
    expect(fetch).toHaveBeenCalledTimes(2);
    const sent = await db.select().from(notifications).where(sql`${notifications.status} = 'sent'`);
    expect(sent.length).toBe(8);
  });

  it("stays a dry run with the switch off, even when set up", async () => {
    const { fetch, senders } = liveSenders();
    const report = await runDaily({ db, now: at(TODAY), allowedEmails: OWNER, sources: [source], senders });
    expect(report.modes.email).toBe("dry");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stays a dry run with the switch on but a setting missing", async () => {
    await switchEmail(true);
    const fetch = vi.fn();
    const senders = { ...SENDERS, email: emailSender(() => ({ RESEND_API_KEY: ENV.RESEND_API_KEY }), { fetch }) };
    const report = await runDaily({ db, now: at(TODAY), allowedEmails: OWNER, sources: [source], senders });
    expect(report.modes.email).toBe("dry");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("a refusal is logged failed, without the address, and retried on a later run", async () => {
    await switchEmail(true);
    const refuse = vi.fn(async () => Response.json({ name: "validation_error", message: "Invalid `to` field: testusernotreal0+tag@gmail.com" }, { status: 422 }));
    await runDaily({ db, now: at(TODAY), allowedEmails: OWNER, sources: [source], senders: { ...SENDERS, email: emailSender(() => ENV, { fetch: refuse }) } });
    const failed = await db.select().from(notifications).where(sql`${notifications.channel} = 'email'`);
    expect(failed.length).toBe(4);
    expect(failed.every((r) => r.status === "failed")).toBe(true);
    expect(failed.every((r) => r.error && !r.error.includes("@") && r.error.includes("422"))).toBe(true);

    const { fetch, senders } = liveSenders();
    await runDaily({ db, now: at(addDays(TODAY, 1)), allowedEmails: OWNER, sources: [source], senders });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("a notice refused three times (MAX_FAILED_TRIES) is not sent again by email", async () => {
    await switchEmail(true);
    const refuse = vi.fn(async () => Response.json({ name: "validation_error", message: "Invalid" }, { status: 422 }));
    const refusing = { ...SENDERS, email: emailSender(() => ENV, { fetch: refuse }) };
    for (let d = 0; d < 3; d++) await runDaily({ db, now: at(addDays(TODAY, d)), allowedEmails: OWNER, sources: [source], senders: refusing });
    expect(refuse).toHaveBeenCalledTimes(3);
    const failed = await db.select().from(notifications).where(sql`${notifications.status} = 'failed'`);
    expect(failed.length).toBe(12); // four notices, three tries each

    // Day four: every notice is still inside its window, but each has used up its tries.
    const { fetch, senders } = liveSenders();
    await runDaily({ db, now: at(addDays(TODAY, 3)), allowedEmails: OWNER, sources: [source], senders });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("a 409 stays pending (unknown) and is never sent again", async () => {
    await switchEmail(true);
    const conflict = vi.fn(async () => Response.json({ name: "concurrent_idempotent_requests", message: "in progress" }, { status: 409 }));
    await runDaily({ db, now: at(TODAY), allowedEmails: OWNER, sources: [source], senders: { ...SENDERS, email: emailSender(() => ENV, { fetch: conflict }) } });
    const rows = await db.select().from(notifications).where(sql`${notifications.channel} = 'email'`);
    expect(rows.length).toBe(4);
    expect(rows.every((r) => r.status === "pending" && r.error?.startsWith("Unknown outcome: Resend answered 409"))).toBe(true);

    const { fetch, senders } = liveSenders();
    await runDaily({ db, now: at(addDays(TODAY, 1)), allowedEmails: OWNER, sources: [source], senders });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("the Idempotency-Key uses the run's day", async () => {
    await switchEmail(true);
    const { fetch, senders } = liveSenders();
    await runDaily({ db, now: at(TODAY), allowedEmails: OWNER, sources: [source], senders });
    const keys = (await db.select().from(notifications).where(sql`${notifications.channel} = 'email'`)).map((r) => r.dedupeKey);
    const headers = fetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe(noticeIdempotencyKey(ENV.NOTIFY_EMAIL_TO, TODAY, keys));
  });

  it("the push-gone notice goes through the real email sender from buildSenders, batched into one email", async () => {
    vi.stubEnv("RESEND_API_KEY", ENV.RESEND_API_KEY);
    vi.stubEnv("NOTIFY_EMAIL_TO", ENV.NOTIFY_EMAIL_TO);
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ id: "email_1" }));
    vi.stubGlobal("fetch", fetch);
    try {
      await switchEmail(true);
      await db.insert(pushSubscriptions).values({ recipient: OWNER, endpoint: "https://web.push.apple.com/gone-1", p256dh: `B${"A".repeat(86)}`, auth: "abcdefghijklmnopqrstuv", deviceLabel: "iPhone", goneAt: at(TODAY) });
      const report = await runDaily({ db, now: at(TODAY), allowedEmails: OWNER, sources: [source], senders: buildSenders(db) });
      expect(report.modes.email).toBe("live");
      expect(fetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
      expect(body.subject).toBe("hub · 5 things coming up");
      expect(body.text).toContain("iPhone stopped accepting pushes");
      expect(body.to).toEqual([ENV.NOTIFY_EMAIL_TO]);
      expect(await db.select().from(pushSubscriptions)).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    }
  });

  it("a push problem never blocks the email: reading gone devices fails, the email still goes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await switchEmail(true);
    await client.exec("drop table push_subscriptions cascade");
    const { fetch, senders } = liveSenders();
    const report = await runDaily({ db, now: at(TODAY), allowedEmails: OWNER, sources: [source], senders });
    expect(report.failedRecipients).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.error).mock.calls.flat().join(" ")).not.toContain(OWNER);
  });

  it("a 5xx stays pending (unknown) and is never sent again", async () => {
    await switchEmail(true);
    const broken = vi.fn(async () => new Response("", { status: 503 }));
    await runDaily({ db, now: at(TODAY), allowedEmails: OWNER, sources: [source], senders: { ...SENDERS, email: emailSender(() => ENV, { fetch: broken }) } });
    const rows = await db.select().from(notifications).where(sql`${notifications.channel} = 'email'`);
    expect(rows.every((r) => r.status === "pending" && r.error === "Unknown outcome: Resend answered 503")).toBe(true);

    const { fetch, senders } = liveSenders();
    await runDaily({ db, now: at(addDays(TODAY, 1)), allowedEmails: OWNER, sources: [source], senders });
    expect(fetch).not.toHaveBeenCalled();
  });
});
