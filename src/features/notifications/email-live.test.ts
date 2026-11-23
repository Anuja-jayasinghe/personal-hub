import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/read";
import { appSettings, notifications } from "@/db/schema";
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
const { emailSender } = await import("./email");

const TODAY = "2026-11-23";
const at = (day: string) => new Date(`${day}T02:10:00Z`); // 07:40 in Colombo
const OWNER = "owner@example.com";
const SECOND = "second@example.com";
const ENV = { RESEND_API_KEY: "re_FAKE_test_key_123456", NOTIFY_EMAIL_TO: "owner+hub@example.com" };

/** Several items whose email windows opened on different days before TODAY. */
const ITEMS: ReminderItem[] = [
  { id: "renewal:r1", title: "Insurance · Silver car", dueDate: addDays(TODAY, 20), href: "/vehicles/v1?tab=renewals", kind: "renewal", notice: { what: "Insurance", who: "Silver car" } },
  { id: "renewal:r2", title: "Revenue license · Blue bike", dueDate: addDays(TODAY, 28), href: "/vehicles/v2?tab=renewals", kind: "renewal", notice: { what: "Revenue license", who: "Blue bike" } },
  { id: "service:s1", title: "Full service · Silver car", dueDate: addDays(TODAY, 9), href: "/vehicles/v1?tab=services", kind: "service", notice: { what: "Full service", who: "Silver car" } },
  { id: "electricity-bill:e1", title: "Electricity bill · LKR 4,250.00", dueDate: addDays(TODAY, 5), href: "/bills#electricity-bill-e1", kind: "bill", notice: { what: "Electricity bill", who: "Main house" } },
];
const source: ReminderSource = { key: "vehicles", label: "Vehicles", load: async () => ITEMS };

let db: Db;
beforeEach(async () => {
  ({ db } = await makeTestDb());
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
    expect(recipientsOf(fetch).sort()).toEqual(["owner+hub@example.com", SECOND]);
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
    const refuse = vi.fn(async () => Response.json({ name: "validation_error", message: "Invalid `to` field: owner+hub@example.com" }, { status: 422 }));
    await runDaily({ db, now: at(TODAY), allowedEmails: OWNER, sources: [source], senders: { ...SENDERS, email: emailSender(() => ENV, { fetch: refuse }) } });
    const failed = await db.select().from(notifications).where(sql`${notifications.channel} = 'email'`);
    expect(failed.length).toBe(4);
    expect(failed.every((r) => r.status === "failed")).toBe(true);
    expect(failed.every((r) => r.error && !r.error.includes("@") && r.error.includes("422"))).toBe(true);

    const { fetch, senders } = liveSenders();
    await runDaily({ db, now: at(addDays(TODAY, 1)), allowedEmails: OWNER, sources: [source], senders });
    expect(fetch).toHaveBeenCalledTimes(1);
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
