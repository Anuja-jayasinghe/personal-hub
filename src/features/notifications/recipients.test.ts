import { describe, expect, it, vi } from "vitest";
import type { NoticeEvent, ReminderItem } from "@/features/reminders/engine";
import { AREAS } from "@/features/people/access";
import { channelModes, parseSwitches } from "./channels";
import { composeMessage, planNotifications } from "./planner";
import { eventsFor, itemsFor, ownerRecipients, personRecipient, type Recipient } from "./recipients";
import { TOPICS, topicNeeds, topicsFor, topicsNeedingReminders } from "./topics";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/db/read", () => ({ readDb: async () => { throw new Error("no database in this test"); } }));

const item = (id: string): ReminderItem => ({ id, title: id, dueDate: "2026-11-23", href: "/", kind: "task" });
const event = (kind: NoticeEvent["event"], key: string = kind): NoticeEvent => ({ event: kind, key, anchor: "2026-11-23", from: "2026-11-23", until: "2026-11-23", href: "/", title: kind, body: "b" });

const OWNER: Recipient = { email: "o@example.com", access: { owner: true }, channels: ["email", "push"], listHref: "/reminders" };
const person = (grants: Record<string, "see" | "add" | "edit">): Recipient =>
  personRecipient({ email: "p@example.com", status: "active", notificationsEnabled: true, grants: Object.entries(grants).map(([area, level]) => ({ area, level })) }, new Set())!;

describe("recipients", () => {
  it("are the owners from ALLOWED_EMAILS, lower-cased, once each, for email and push", () => {
    expect(ownerRecipients(" Owner@Example.com, second@example.com;owner@example.com nonsense")).toEqual([
      { email: "owner@example.com", access: { owner: true }, channels: ["email", "push"], listHref: "/reminders" },
      { email: "second@example.com", access: { owner: true }, channels: ["email", "push"], listHref: "/reminders" },
    ]);
    expect(ownerRecipients(undefined)).toEqual([]);
  });

  it("owners hear about every source; a person only about the sections they may see", () => {
    const loaded = [
      { area: "vehicles" as const, items: [item("renewal:1")] },
      { area: "bills" as const, items: [item("bill-item:1")] },
      { area: "tasks_notes" as const, items: [item("task:1")] },
    ];
    expect(itemsFor(OWNER, loaded).map((i) => i.id)).toEqual(["renewal:1", "bill-item:1", "task:1"]);
    // Due dates need the Reminders section too, exactly as the Reminders page does.
    expect(itemsFor(person({ reminders: "see", bills: "see" }), loaded).map((i) => i.id)).toEqual(["bill-item:1"]);
    expect(itemsFor(person({ reminders: "see" }), loaded)).toEqual([]);
    expect(itemsFor(person({}), loaded)).toEqual([]);
  });

  it("a person with Bills and Vehicles but no Reminders hears nothing about due dates", () => {
    const loaded = [
      { area: "vehicles" as const, items: [item("renewal:1")] },
      { area: "bills" as const, items: [item("bill-item:1")] },
    ];
    expect(itemsFor(person({ bills: "edit", vehicles: "edit", tasks_notes: "edit", electricity_bills: "edit" }), loaded)).toEqual([]);
    expect(itemsFor(person({ reminders: "see", bills: "see", vehicles: "see" }), loaded).map((i) => i.id)).toEqual(["renewal:1", "bill-item:1"]);
  });
});

describe("a shared person as a recipient (N.5, C144)", () => {
  const owners = new Set(["owner@example.com"]);
  const row = (over: Partial<Parameters<typeof personRecipient>[0]> = {}) => ({ email: "Friend@Example.com", status: "active", notificationsEnabled: true, grants: [{ area: "bills", level: "see" }], ...over });

  it("is push only, with the access their grants give", () => {
    expect(personRecipient(row(), owners)).toEqual({ email: "friend@example.com", access: { owner: false, grants: { bills: "see" } }, channels: ["push"], listHref: "/" });
  });

  it("opens Reminders for a batch of different pages only for someone who may see it, otherwise Home", () => {
    expect(person({ bills: "see" }).listHref).toBe("/");
    expect(person({ electricity_readings: "add" }).listHref).toBe("/");
    expect(person({ reminders: "see", bills: "see" }).listHref).toBe("/reminders");
    expect(person({ reminders: "edit" }).listHref).toBe("/reminders");
    expect(OWNER.listHref).toBe("/reminders");
  });

  it("is nobody while pending or blocked, or with notifications switched off", () => {
    expect(personRecipient(row({ status: "pending" }), owners)).toBeNull();
    expect(personRecipient(row({ status: "blocked" }), owners)).toBeNull();
    expect(personRecipient(row({ status: "anything else" }), owners)).toBeNull();
    expect(personRecipient(row({ notificationsEnabled: false }), owners)).toBeNull();
  });

  it("is never an owner's address (an owner is one recipient, with email)", () => {
    expect(personRecipient(row({ email: "OWNER@example.com" }), owners)).toBeNull();
  });

  it("ignores grants for a section or level that does not exist", () => {
    const r = personRecipient(row({ grants: [{ area: "nonsense", level: "see" }, { area: "bills", level: "root" }] }), owners);
    expect(r?.access).toEqual({ owner: false, grants: {} });
  });
});

describe("events for a recipient", () => {
  const loaded = [
    { area: "electricity_readings" as const, items: [event("slab-near", "a"), event("slab-over", "b"), event("reading-due", "c")] },
    { area: "owner" as const, items: [event("access-request", "d")] },
  ];
  const keys = (r: Recipient, l = loaded) => eventsFor(r, l).map((e) => e.key);

  it("owners hear them all", () => {
    expect(keys(OWNER)).toEqual(["a", "b", "c", "d"]);
  });

  it("Electricity readings at see gives the slab events but not 'reading due'", () => {
    expect(keys(person({ electricity_readings: "see" }))).toEqual(["a", "b"]);
  });

  it("Electricity readings at add or edit also gives 'reading due'", () => {
    expect(keys(person({ electricity_readings: "add" }))).toEqual(["a", "b", "c"]);
    expect(keys(person({ electricity_readings: "edit" }))).toEqual(["a", "b", "c"]);
  });

  it("a person with no electricity grant hears none of them, and electricity bills do not count", () => {
    expect(keys(person({}))).toEqual([]);
    expect(keys(person({ electricity_bills: "edit", bills: "edit", vehicles: "edit", tasks_notes: "edit" }))).toEqual([]);
  });

  it("a sign-up request never reaches a person, with every grant at edit", () => {
    const everything = Object.fromEntries(AREAS.map((a) => [a.key, "edit" as const]));
    expect(keys(person(everything))).toEqual(["a", "b", "c"]);
  });

  it("a sign-up request stays owner-only even when its source is filed under another section", () => {
    const misfiled = [{ area: "electricity_readings" as const, items: [event("access-request", "x")] }];
    expect(keys(person({ electricity_readings: "edit" }), misfiled)).toEqual([]);
    expect(keys(OWNER, misfiled)).toEqual(["x"]);
  });
});

describe("where a mixed batch opens (N.5)", () => {
  const today = "2026-11-22";
  const items: ReminderItem[] = [
    { id: "bill-item:1", title: "x", dueDate: "2026-11-23", href: "/bills", kind: "bill", notice: { what: "Water bill" } },
    { id: "renewal:1", title: "x", dueDate: "2026-11-23", href: "/vehicles/v1", kind: "renewal", notice: { what: "Insurance", who: "Car" } },
  ];
  const plan = (listHref?: string) => planNotifications({ recipient: "p@example.com", items, today, usedKeys: new Set(), channels: ["push"], listHref });

  it("opens the recipient's own list page: Reminders only for someone who may see it, otherwise Home", () => {
    expect(plan("/").messages[0].href).toBe("/");
    expect(plan("/reminders").messages[0].href).toBe("/reminders");
    // The default (owners) is unchanged.
    expect(plan().messages[0].href).toBe("/reminders");
    expect(plan().messages[0]).not.toHaveProperty("listHref");
  });

  it("is kept on the message, so a re-batch of what was claimed opens the same page", () => {
    const [m] = plan("/").messages;
    expect(m.listHref).toBe("/");
    expect(composeMessage(m.recipient, m.channel, m.notices, m.listHref).href).toBe("/");
  });
});

describe("what the notifications page says", () => {
  it("lists a topic for every section a shared person can be told about", async () => {
    const { SOURCE_AREA } = await import("@/features/reminders/sources");
    const told = new Set(Object.values(SOURCE_AREA).filter((a) => a !== "owner"));
    expect(new Set(TOPICS.map((t) => t.area))).toEqual(told);
  });

  it("follows the grants, and 'readings due' needs Add", () => {
    expect(topicsFor({ owner: false, grants: {} })).toEqual([]);
    // Due dates need Reminders too; electricity events do not.
    expect(topicsFor({ owner: false, grants: { bills: "see" } })).toEqual([]);
    expect(topicsFor({ owner: false, grants: { bills: "see", reminders: "see" } }).map((t) => t.key)).toEqual(["bills"]);
    expect(topicsFor({ owner: false, grants: { electricity_readings: "see" } }).map((t) => t.key)).toEqual(["slab"]);
    expect(topicsFor({ owner: false, grants: { electricity_readings: "add" } }).map((t) => t.key)).toEqual(["readings-due", "slab"]);
    expect(topicsFor({ owner: true })).toHaveLength(TOPICS.length);
  });

  it("says which grants are missing: the due-date topics held back until Reminders is given", () => {
    expect(topicsNeedingReminders({ owner: false, grants: { bills: "see", vehicles: "see", electricity_readings: "see" } }).map((t) => t.key)).toEqual(["bills", "vehicles"]);
    expect(topicsNeedingReminders({ owner: false, grants: { bills: "see", reminders: "see" } })).toEqual([]);
    expect(topicsNeedingReminders({ owner: true })).toEqual([]);
    expect(topicNeeds(TOPICS.find((t) => t.key === "vehicles")!)).toBe("Vehicles + Reminders");
    expect(topicNeeds(TOPICS.find((t) => t.key === "readings-due")!)).toBe("Electricity readings at Add");
    expect(topicNeeds(TOPICS.find((t) => t.key === "slab")!)).toBe("Electricity readings");
  });

  it("matches what the run sends: holding a topic's grants (and Reminders for due dates) is exactly what opens it", () => {
    const loaded = [
      { area: "electricity_readings" as const, items: [] },
      { area: "electricity_bills" as const, items: [item("electricity-bill:1")] },
      { area: "bills" as const, items: [item("bill-item:1")] },
      { area: "vehicles" as const, items: [item("renewal:1")] },
      { area: "tasks_notes" as const, items: [item("task:1")] },
    ];
    const events = [{ area: "electricity_readings" as const, items: [event("slab-near", "s"), event("reading-due", "r")] }];
    for (const t of TOPICS) {
      const grants = { [t.area]: t.level, ...(t.needsReminders ? { reminders: "see" as const } : {}) };
      const p = person(grants);
      expect(topicsFor(p.access).map((x) => x.key)).toContain(t.key);
      const heard = t.needsReminders ? itemsFor(p, loaded).length > 0 : eventsFor(p, events).length > 0;
      expect(heard, t.key).toBe(true);
      // Without the Reminders grant a due-date topic is neither promised nor sent.
      if (t.needsReminders) {
        const q = person({ [t.area]: t.level });
        expect(topicsFor(q.access).map((x) => x.key)).not.toContain(t.key);
        expect(itemsFor(q, loaded)).toEqual([]);
      }
    }
  });
});

describe("channel switches", () => {
  it("default to off, and anything malformed is off", () => {
    expect(parseSwitches(null)).toEqual({ email: { enabled: false }, push: { enabled: false } });
    expect(parseSwitches({ email: { enabled: "yes" }, push: true })).toEqual({ email: { enabled: false }, push: { enabled: false } });
    expect(parseSwitches({ email: { enabled: true } })).toEqual({ email: { enabled: true }, push: { enabled: false } });
  });

  it("a channel is live only when it is built AND switched on", () => {
    const on = parseSwitches({ email: { enabled: true }, push: { enabled: true } });
    expect(channelModes(on, { email: { implemented: true }, push: { implemented: false } })).toEqual({ email: "live", push: "dry" });
    expect(channelModes(parseSwitches(null), { email: { implemented: true }, push: { implemented: true } })).toEqual({ email: "dry", push: "dry" });
  });
});
