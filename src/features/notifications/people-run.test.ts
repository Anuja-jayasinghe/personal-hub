import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/read";
import { accessGrants, notifications, people, pushSubscriptions } from "@/db/schema";
import type { NoticeEvent, NoticeSource, ReminderItem, ReminderSource } from "@/features/reminders/engine";
import { addDays } from "@/lib/dates";
import { makeTestDb } from "@/test/pglite";
import { NotSentError, type ChannelSender } from "./channels";
import type { Message } from "./planner";

/**
 * The daily run for shared people (Notifications N.5, DECISIONS C144) against an in-memory Postgres:
 * who is written to, what each person hears (exactly what the Reminders page would show them), push
 * only, never email, and the owners unchanged. Sources are fixed made-up lists under the real source
 * keys (so the real SOURCE_AREA decides the sections); the senders are fakes; `readDb()` throws.
 * Everything is made up (public repo): example addresses, a made-up plate and amount that must never be sent.
 */
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/db/read", () => ({
  readDb: async () => {
    throw new Error("readDb must not be used by the daily run");
  },
}));

const { runDaily } = await import("./daily");

const TODAY = "2026-11-23";
const at = (day: string) => new Date(`${day}T02:10:00Z`);
const OWNER = "owner@example.com";
const P256DH = `B${"A".repeat(86)}`;
const AUTH = "abcdefghijklmnopqrstuv";
const PLATE = "ZZZ-9999";
const AMOUNT = "LKR 9,999.99";
const TASK_WORDS = "buy the secret thing";

const item = (id: string, kind: string, dueDate: string, what: string, who: string | undefined, href: string): ReminderItem => ({
  id,
  kind,
  dueDate,
  href,
  // The title is never sent: it may hold a plate, an amount or free text.
  title: `${what} ${PLATE} ${AMOUNT} ${TASK_WORDS}`,
  notice: { what, who },
});
const tomorrow = addDays(TODAY, 1);
const ITEMS: Record<string, ReminderItem[]> = {
  "vehicle-renewals": [
    item("renewal:r1", "renewal", tomorrow, "Insurance", "Silver car", "/vehicles/v1"),
    // Inside its 30 day window: an owner gets the plan-ahead EMAIL; a person never does.
    item("renewal:r2", "renewal", addDays(TODAY, 20), "Revenue license", "Blue bike", "/vehicles/v2"),
  ],
  "bill-items": [item("bill-item:b1", "bill", tomorrow, "Water bill", undefined, "/bills")],
  "electricity-bills": [item("electricity-bill:e1", "bill", tomorrow, "Electricity bill", "Main house", "/bills")],
  tasks: [item("task:t1", "task", TODAY, "Task", undefined, "/tasks")],
};
const reminderSources: ReminderSource[] = Object.entries(ITEMS).map(([key, items]) => ({ key, label: key, load: async () => items }));

const ev = (event: NoticeEvent["event"], key: string, href: string, title: string): NoticeEvent => ({ event, key, anchor: TODAY, from: TODAY, until: addDays(TODAY, 7), href, title, body: "Meter A" });
const noticeSources: NoticeSource[] = [
  {
    key: "electricity-notices",
    label: "Electricity",
    load: async () => [ev("slab-near", "slab:m1:near:2026-11-01", "/electricity", "108 of 120 units used"), ev("reading-due", "reading-due:m1:2026-11-18", "/electricity", "Meter reading due")],
  },
  { key: "access-requests", label: "Sign-ups", load: async () => [ev("access-request", "access-request:p1", "/settings/people", "Someone asked for access")] },
];

let db: Db;
let client: Awaited<ReturnType<typeof makeTestDb>>["client"];
let pushed: Message[];
let emailed: Message[];
let pushSend: (m: Message) => Promise<void>;

const senders = () => ({
  email: { channel: "email" as const, implemented: true, send: async (m: Message) => void emailed.push(m) } satisfies ChannelSender,
  push: { channel: "push" as const, implemented: true, send: (m: Message) => pushSend(m) } satisfies ChannelSender,
});

const run = (day = TODAY, allowedEmails = OWNER) => {
  vi.setSystemTime(at(day));
  return runDaily({ db, now: at(day), allowedEmails, sources: reminderSources, noticeSources, senders: senders() });
};

type Grants = Record<string, "see" | "add" | "edit">;
async function addPerson(email: string, grants: Grants, over: { status?: "pending" | "active" | "blocked"; enabled?: boolean; device?: boolean; reminders?: boolean } = {}) {
  // Due dates need the Reminders section too (N.5): given by default, so each test is about the one thing it names.
  const all: Grants = over.reminders === false ? grants : { reminders: "see", ...grants };
  const [p] = await db
    .insert(people)
    .values({ email, status: over.status ?? "active", notificationsEnabled: over.enabled ?? true })
    .returning();
  for (const [area, level] of Object.entries(all)) await db.insert(accessGrants).values({ personId: p.id, area, level });
  if (over.device ?? true) await db.insert(pushSubscriptions).values({ recipient: email, endpoint: `https://web.push.apple.com/${email}`, p256dh: P256DH, auth: AUTH, deviceLabel: "iPhone" });
  return p;
}

const rowsOf = (recipient: string) => db.select().from(notifications).where(eq(notifications.recipient, recipient));
const kindsOf = async (recipient: string) => (await rowsOf(recipient)).map((r) => r.kind).sort();
const pushedTo = (email: string) => pushed.filter((m) => m.recipient === email);

beforeEach(async () => {
  vi.useRealTimers();
  ({ db, client } = await makeTestDb());
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(at(TODAY));
  pushed = [];
  emailed = [];
  pushSend = async (m) => void pushed.push(m);
  // Both channels live, so what goes out is what a sender would be given.
  await db.execute(sql`insert into app_settings (key, value) values ('notifications', '{"email":{"enabled":true},"push":{"enabled":true}}'::jsonb)`);
}, 60_000);

describe("who the run writes to", () => {
  it("an owner is unchanged: every source, email and push", async () => {
    const report = await run();
    expect(report.recipients).toBe(1);
    expect(report.people).toBe(0);
    expect(await kindsOf(OWNER)).toEqual(["access-request", "bill", "electricity-bill", "reading-due", "renewal", "renewal", "slab-near", "task"]);
    expect(emailed.map((m) => m.recipient)).toEqual([OWNER]);
    expect(pushedTo(OWNER)).toHaveLength(1);
  });

  it("a person with no grants gets nothing", async () => {
    await addPerson("none@example.com", {});
    const report = await run();
    expect(report.people).toBe(1);
    expect(await rowsOf("none@example.com")).toEqual([]);
    expect(pushedTo("none@example.com")).toEqual([]);
    expect(emailed.some((m) => m.recipient === "none@example.com")).toBe(false);
  });

  it("a person with only the bills grant gets only bill notices", async () => {
    await addPerson("bills@example.com", { bills: "see" });
    await run();
    expect(await kindsOf("bills@example.com")).toEqual(["bill"]);
    const [m] = pushedTo("bills@example.com");
    expect(m.title).toBe("Water bill due tomorrow");
  });

  it("each section opens its own notices: electricity bills, vehicles, tasks", async () => {
    await addPerson("e@example.com", { electricity_bills: "see" });
    await addPerson("v@example.com", { vehicles: "see" });
    await addPerson("t@example.com", { tasks_notes: "see" });
    await run();
    expect(await kindsOf("e@example.com")).toEqual(["electricity-bill"]);
    // The vehicle renewal due tomorrow, by push; the 20-day one waits for an email a person never gets.
    expect(await kindsOf("v@example.com")).toEqual(["renewal"]);
    expect(await kindsOf("t@example.com")).toEqual(["task"]);
  });

  it("a person with Bills, Vehicles, Tasks and Electricity bills but no Reminders hears nothing about due dates", async () => {
    await addPerson("noreminders@example.com", { bills: "edit", vehicles: "edit", tasks_notes: "edit", electricity_bills: "edit" }, { reminders: false });
    const report = await run();
    expect(report.people).toBe(1);
    expect(await rowsOf("noreminders@example.com")).toEqual([]);
    expect(pushedTo("noreminders@example.com")).toEqual([]);
  });

  it("electricity events do not need Reminders, and a batch of them opens Electricity", async () => {
    await addPerson("meter@example.com", { electricity_readings: "add" }, { reminders: false });
    await run();
    expect(await kindsOf("meter@example.com")).toEqual(["reading-due", "slab-near"]);
    const [m] = pushedTo("meter@example.com");
    expect(m.notices).toHaveLength(2);
    expect(m.href).toBe("/electricity");
    // A single one opens it too, and never the Reminders page.
    await addPerson("seeonly@example.com", { electricity_readings: "see" }, { reminders: false });
    await run(addDays(TODAY, 1));
    expect(pushedTo("seeonly@example.com").map((x) => x.href)).toEqual(["/electricity"]);
    expect(pushed.every((x) => x.recipient === OWNER || x.href !== "/reminders")).toBe(true);
  });

  it("with Reminders, a batch about different pages opens Reminders", async () => {
    await addPerson("mixed@example.com", { bills: "see", tasks_notes: "see" });
    await run();
    const [m] = pushedTo("mixed@example.com");
    expect(m.notices.map((n) => n.event).sort()).toEqual(["bill", "task"]);
    expect(m.href).toBe("/reminders");
    expect(m.listHref).toBe("/reminders");
  });

  it("electricity readings at See: slab events but not 'reading due'; at Add: both", async () => {
    await addPerson("see@example.com", { electricity_readings: "see" });
    await addPerson("add@example.com", { electricity_readings: "add" });
    await run();
    expect(await kindsOf("see@example.com")).toEqual(["slab-near"]);
    expect(await kindsOf("add@example.com")).toEqual(["reading-due", "slab-near"]);
  });

  it("'reading due' stops for everyone once a reading is added (the event goes away)", async () => {
    await addPerson("add@example.com", { electricity_readings: "add" });
    const gone: NoticeSource[] = [{ key: "electricity-notices", label: "Electricity", load: async () => [] }, noticeSources[1]];
    vi.setSystemTime(at(TODAY));
    await runDaily({ db, now: at(TODAY), allowedEmails: OWNER, sources: [], noticeSources: gone, senders: senders() });
    expect(await rowsOf("add@example.com")).toEqual([]);
  });

  it("a sign-up request never reaches a person, whatever their grants", async () => {
    const all: Grants = { electricity_readings: "edit", electricity_bills: "edit", bills: "edit", vehicles: "edit", vehicle_documents: "edit", reminders: "edit", tasks_notes: "edit" };
    await addPerson("all@example.com", all);
    await run();
    const kinds = await kindsOf("all@example.com");
    expect(kinds).not.toContain("access-request");
    expect(kinds).toEqual(["bill", "electricity-bill", "reading-due", "renewal", "slab-near", "task"]);
    expect(pushedTo("all@example.com").flatMap((m) => m.notices.map((n) => n.event))).not.toContain("access-request");
    expect(pushedTo(OWNER).flatMap((m) => m.notices.map((n) => n.event))).toContain("access-request");
  });

  it("pending and blocked people get nothing and are not recipients", async () => {
    await addPerson("pending@example.com", { bills: "edit" }, { status: "pending" });
    await addPerson("blocked@example.com", { bills: "edit" }, { status: "blocked" });
    const report = await run();
    expect(report.people).toBe(0);
    expect(await rowsOf("pending@example.com")).toEqual([]);
    expect(await rowsOf("blocked@example.com")).toEqual([]);
    expect(pushed.filter((m) => m.recipient !== OWNER)).toEqual([]);
  });

  it("a person the owner switched notifications off for is skipped", async () => {
    const p = await addPerson("off@example.com", { bills: "see" }, { enabled: false });
    expect((await run()).people).toBe(0);
    expect(await rowsOf("off@example.com")).toEqual([]);
    // Switched back on, they are written to the next day.
    await db.update(people).set({ notificationsEnabled: true }).where(eq(people.id, p.id));
    expect((await run(addDays(TODAY, 1))).people).toBe(1);
  });

  it("a person with no device, or only a gone one, is skipped", async () => {
    await addPerson("nodevice@example.com", { bills: "see" }, { device: false });
    await addPerson("gone@example.com", { bills: "see" });
    await db.update(pushSubscriptions).set({ goneAt: at(TODAY) }).where(eq(pushSubscriptions.recipient, "gone@example.com"));
    expect((await run()).people).toBe(0);
    expect(await rowsOf("nodevice@example.com")).toEqual([]);
    expect(await rowsOf("gone@example.com")).toEqual([]);
  });

  it("a revoked grant stops its notices at the next run; a blocked person stops altogether", async () => {
    const p = await addPerson("p@example.com", { bills: "see", tasks_notes: "see" });
    await run();
    expect(await kindsOf("p@example.com")).toEqual(["bill", "task"]);

    // Day 2: the owner revokes Tasks; new items are due in both sections.
    await db.delete(accessGrants).where(sql`${accessGrants.personId} = ${p.id} and ${accessGrants.area} = 'tasks_notes'`);
    const day2 = addDays(TODAY, 1);
    const fresh: ReminderSource[] = [
      { key: "bill-items", label: "b", load: async () => [item("bill-item:b2", "bill", addDays(day2, 1), "Gas bill", undefined, "/bills")] },
      { key: "tasks", label: "t", load: async () => [item("task:t2", "task", day2, "Task", undefined, "/tasks")] },
    ];
    vi.setSystemTime(at(day2));
    await runDaily({ db, now: at(day2), allowedEmails: OWNER, sources: fresh, noticeSources: [], senders: senders() });
    expect(await kindsOf("p@example.com")).toEqual(["bill", "bill", "task"]);

    // Day 3: blocked; something new is due, and nothing is sent.
    await db.update(people).set({ status: "blocked" }).where(eq(people.id, p.id));
    const day3 = addDays(TODAY, 2);
    const third: ReminderSource[] = [{ key: "bill-items", label: "b", load: async () => [item("bill-item:b3", "bill", addDays(day3, 1), "Phone bill", undefined, "/bills")] }];
    vi.setSystemTime(at(day3));
    await runDaily({ db, now: at(day3), allowedEmails: OWNER, sources: third, noticeSources: [], senders: senders() });
    expect(await kindsOf("p@example.com")).toEqual(["bill", "bill", "task"]);
  });

  it("an owner's address in the people table is still only an owner", async () => {
    await addPerson(OWNER, { bills: "see" });
    const report = await run();
    expect(report.recipients).toBe(1);
    expect(report.people).toBe(0);
  });
});

describe("what a person is sent", () => {
  it("push only, never email, and one push a day however many things are due", async () => {
    await addPerson("all@example.com", { bills: "see", vehicles: "see", tasks_notes: "see", electricity_bills: "see" });
    await run();
    expect(emailed.some((m) => m.recipient === "all@example.com")).toBe(false);
    const rows = await rowsOf("all@example.com");
    expect(rows.every((r) => r.channel === "push")).toBe(true);
    // Batched: one push for the day.
    expect(pushedTo("all@example.com")).toHaveLength(1);
    expect(pushedTo("all@example.com")[0].notices.length).toBe(rows.length);
    // The owner still gets the plan-ahead email for the 20-day renewal.
    expect(emailed.map((m) => m.recipient)).toEqual([OWNER]);
  });

  it("the plan-ahead email is simply not planned for a person: no row, no held notice", async () => {
    await addPerson("v@example.com", { vehicles: "see" });
    const report = await run();
    const rows = await rowsOf("v@example.com");
    expect(rows.map((r) => r.dedupeKey)).toEqual([`renewal:r1:act:${tomorrow}`]);
    expect(report.held).toBe(0);
  });

  it("never carries an amount, a plate, a document number or free text", async () => {
    await addPerson("all@example.com", { bills: "see", vehicles: "see", tasks_notes: "see", electricity_bills: "see", electricity_readings: "edit" });
    await run();
    const everything = [
      ...(await rowsOf("all@example.com")).flatMap((r) => [r.title, r.body, r.href]),
      ...pushedTo("all@example.com").flatMap((m) => [m.title, m.body, m.href, ...m.notices.flatMap((n) => [n.title, n.body])]),
    ].join("\n");
    expect(everything).not.toContain(PLATE);
    expect(everything).not.toContain("LKR");
    expect(everything).not.toContain(AMOUNT);
    expect(everything).not.toContain(TASK_WORDS);
    expect(everything).not.toMatch(/@/);
  });

  it("each person is deduped on their own, and a second run the same day sends nothing", async () => {
    await addPerson("a@example.com", { bills: "see" });
    await addPerson("b@example.com", { bills: "see" });
    await run();
    const before = pushed.length;
    expect(await kindsOf("a@example.com")).toEqual(["bill"]);
    expect(await kindsOf("b@example.com")).toEqual(["bill"]);
    await run();
    expect(pushed).toHaveLength(before);
    expect((await rowsOf("a@example.com")).length).toBe(1);
  });

  it("a push refused three times stops retrying for that person", async () => {
    await addPerson("a@example.com", { vehicles: "see" });
    pushSend = async (m) => {
      if (m.recipient === "a@example.com") throw new NotSentError("refused");
    };
    // Overdue pushes may go for 7 days; the cap is three tries.
    const overdue: ReminderSource[] = [{ key: "vehicle-renewals", label: "v", load: async () => [item("renewal:old", "renewal", addDays(TODAY, -1), "Insurance", "Silver car", "/vehicles/v1")] }];
    let tries = 0;
    for (let d = 0; d < 6; d++) {
      const day = addDays(TODAY, d);
      vi.setSystemTime(at(day));
      const before = (await rowsOf("a@example.com")).filter((r) => r.status === "failed").length;
      await runDaily({ db, now: at(day), allowedEmails: OWNER, sources: overdue, noticeSources: [], senders: senders() });
      tries += (await rowsOf("a@example.com")).filter((r) => r.status === "failed").length - before;
    }
    expect(tries).toBe(3);
  });

  it("a device that stops accepting pushes is never emailed about, for a person", async () => {
    // The real sender, with a fake push service answering 410, and email as it is built in senders.ts (owners only).
    const { createPushSender } = await import("./push/sender");
    const email = { implemented: true, send: vi.fn(async () => {}) };
    const p = await addPerson("a@example.com", { bills: "see" });
    const owner = await db.insert(pushSubscriptions).values({ recipient: OWNER, endpoint: "https://web.push.apple.com/owner-device", p256dh: P256DH, auth: AUTH, deviceLabel: "iPhone" }).returning();
    const push = createPushSender({
      db,
      transport: async () => 410,
      emailSender: email,
      now: () => at(TODAY),
      canEmail: (r) => r === OWNER,
    });
    const msg = (recipient: string): Message => ({ recipient, channel: "push", title: "t", body: "b", href: "/", notices: [] });
    await expect(push.send(msg("a@example.com"))).rejects.toBeInstanceOf(NotSentError);
    // Marked gone, with no email notice written or sent about it.
    const [row] = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.recipient, "a@example.com"));
    expect(row.goneAt).not.toBeNull();
    expect(await rowsOf("a@example.com")).toEqual([]);
    expect(email.send).not.toHaveBeenCalled();
    void p;

    // The owner's device gets the email notice as before.
    await expect(push.send(msg(OWNER))).rejects.toBeInstanceOf(NotSentError);
    expect((await rowsOf(OWNER)).map((r) => r.kind)).toEqual(["push-gone"]);
    expect(owner).toHaveLength(1);
  });

  it("the daily run leaves a person's gone device marked, writes no email for it and keeps the row for their page", async () => {
    await addPerson("a@example.com", { bills: "see" });
    await addPerson("b@example.com", { bills: "see" }, { device: false });
    await db.insert(pushSubscriptions).values({ recipient: "b@example.com", endpoint: "https://web.push.apple.com/b-gone", p256dh: P256DH, auth: AUTH, deviceLabel: "iPhone", goneAt: at(TODAY) });
    await run();
    expect(emailed.some((m) => m.recipient === "b@example.com")).toBe(false);
    expect((await rowsOf("b@example.com")).filter((r) => r.kind === "push-gone")).toEqual([]);
    expect(await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.recipient, "b@example.com"))).toHaveLength(1);
  });
});

describe("a problem reading people", () => {
  it("never stops the owners' run", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await addPerson("a@example.com", { bills: "see" });
    // The code deployed before its migration: the column is not there.
    await client.exec("alter table people drop column notifications_enabled");
    const report = await run();
    expect(report.failedRecipients).toBe(1);
    expect(report.people).toBe(0);
    expect(report.recipients).toBe(1);
    expect((await rowsOf(OWNER)).length).toBeGreaterThan(0);
    expect(vi.mocked(console.error).mock.calls.flat().join(" ")).not.toContain("a@example.com");
  });
});
