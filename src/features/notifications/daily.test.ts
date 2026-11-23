import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/read";
import { notifications, pushSubscriptions } from "@/db/schema";
import type { ReminderSource } from "@/features/reminders/engine";
import { makeTestDb } from "@/test/pglite";

/**
 * The daily run end to end against an in-memory Postgres filled with the demo's made-up data. Nothing
 * here touches the real database; `readDb()` throws, so the run can only use the database it is given.
 */
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/db/read", () => ({
  readDb: async () => {
    throw new Error("readDb must not be used by the daily run");
  },
}));

const { runDaily } = await import("./daily");
const { reminderSources } = await import("@/features/reminders/sources");

const TODAY = "2026-11-23";
// 02:10 UTC = 07:40 in Colombo, when the cron runs.
const MORNING = new Date(`${TODAY}T02:10:00Z`);
const OWNER = "owner@example.com";

let db: Db;
let client: Awaited<ReturnType<typeof makeTestDb>>["client"];

beforeEach(async () => {
  ({ db, client } = await makeTestDb({ today: TODAY }));
}, 60_000);

const rowsOf = (recipient: string) => db.select().from(notifications).where(sql`${notifications.recipient} = ${recipient}`);

describe("runDaily", () => {
  it("the first run writes dry-run rows and sends nothing", async () => {
    const report = await runDaily({ db, now: MORNING, allowedEmails: OWNER });
    expect(report.modes).toEqual({ email: "dry", push: "dry" });
    expect(report.recipients).toBe(1);
    expect(report.failedSources).toBe(0);
    expect(report.rows.sent).toBe(0);
    expect(report.rows.dryRun).toBeGreaterThan(0);
    const rows = await rowsOf(OWNER);
    expect(rows.length).toBe(report.rows.dryRun);
    expect(rows.every((r) => r.status === "dry_run" && r.sentAt === null)).toBe(true);
    expect(report.messages.email + report.messages.push).toBeLessThanOrEqual(2);
  });

  it("a second run on the same day writes nothing", async () => {
    await runDaily({ db, now: MORNING, allowedEmails: OWNER });
    const before = (await rowsOf(OWNER)).length;
    const again = await runDaily({ db, now: new Date(MORNING.getTime() + 60 * 60 * 1000), allowedEmails: OWNER });
    expect(again.rows.dryRun).toBe(0);
    expect(again.messages).toEqual({ email: 0, push: 0 });
    expect((await rowsOf(OWNER)).length).toBe(before);
  });

  it("each recipient gets their own rows", async () => {
    const report = await runDaily({ db, now: MORNING, allowedEmails: `${OWNER}, Second@Example.com` });
    expect(report.recipients).toBe(2);
    const a = await rowsOf(OWNER);
    const b = await rowsOf("second@example.com");
    expect(a.length).toBeGreaterThan(0);
    expect(b.map((r) => r.dedupeKey).sort()).toEqual(a.map((r) => r.dedupeKey).sort());
  });

  it("one source failing does not stop the others", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const broken: ReminderSource = {
      key: "broken",
      label: "Broken",
      load: async () => {
        throw new Error("owner@example.com should never be logged");
      },
    };
    const report = await runDaily({ db, now: MORNING, allowedEmails: OWNER, sources: [broken, ...reminderSources] });
    expect(report.failedSources).toBe(1);
    expect(report.rows.dryRun).toBeGreaterThan(0);
    expect(vi.mocked(console.error).mock.calls.flat().join(" ")).not.toContain("owner@example.com");
  });

  it("one recipient failing does not stop the other", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // The database refuses every row for one address.
    await client.exec(`
      create function refuse_broken() returns trigger language plpgsql as $$
      begin
        if new.recipient = 'broken@example.com' then raise exception 'refused'; end if;
        return new;
      end $$;
      create trigger refuse_broken before insert on notifications for each row execute function refuse_broken();
    `);
    const report = await runDaily({ db, now: MORNING, allowedEmails: `broken@example.com, ${OWNER}` });
    expect(report.failedRecipients).toBe(1);
    expect((await rowsOf(OWNER)).length).toBeGreaterThan(0);
    expect((await rowsOf("broken@example.com")).length).toBe(0);
    expect(vi.mocked(console.error).mock.calls.flat().join(" ")).not.toContain("broken@example.com");
  });

  it("a held 'stopped accepting pushes' notice joins the day's email once, then its device row goes (N.3)", async () => {
    const [gone] = await db
      .insert(pushSubscriptions)
      .values({ recipient: OWNER, endpoint: "https://web.push.apple.com/gone", p256dh: `B${"A".repeat(86)}`, auth: "abcdefghijklmnopqrstuv", deviceLabel: "iPhone", goneAt: MORNING })
      .returning();
    const report = await runDaily({ db, now: MORNING, allowedEmails: OWNER });
    expect(report.messages.email).toBe(1);
    const rows = await rowsOf(OWNER);
    expect(rows.filter((r) => r.kind === "push-gone").map((r) => r.dedupeKey)).toEqual([`push-gone:${gone.id}`]);
    expect(await db.select().from(pushSubscriptions)).toEqual([]);
    // The next run has nothing more to say about it.
    await runDaily({ db, now: new Date(MORNING.getTime() + 24 * 60 * 60 * 1000), allowedEmails: OWNER });
    expect((await rowsOf(OWNER)).filter((r) => r.kind === "push-gone")).toHaveLength(1);
  });

  it("with nobody on the list it writes nothing", async () => {
    const report = await runDaily({ db, now: MORNING, allowedEmails: "" });
    expect(report.recipients).toBe(0);
    expect(await db.select().from(notifications)).toEqual([]);
  });
});
