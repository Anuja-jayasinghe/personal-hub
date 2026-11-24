import { describe, expect, it, vi } from "vitest";
import type { NoticeEvent, ReminderItem } from "@/features/reminders/engine";
import { AREAS } from "@/features/people/access";
import { channelModes, parseSwitches } from "./channels";
import { eventsFor, itemsFor, ownerRecipients, personRecipient, type Recipient } from "./recipients";
import { TOPICS, topicsFor } from "./topics";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/db/read", () => ({ readDb: async () => { throw new Error("no database in this test"); } }));

const item = (id: string): ReminderItem => ({ id, title: id, dueDate: "2026-11-23", href: "/", kind: "task" });
const event = (kind: NoticeEvent["event"], key: string = kind): NoticeEvent => ({ event: kind, key, anchor: "2026-11-23", from: "2026-11-23", until: "2026-11-23", href: "/", title: kind, body: "b" });

const OWNER: Recipient = { email: "o@example.com", access: { owner: true }, channels: ["email", "push"] };
const person = (grants: Record<string, "see" | "add" | "edit">): Recipient => ({ email: "p@example.com", access: { owner: false, grants }, channels: ["push"] });

describe("recipients", () => {
  it("are the owners from ALLOWED_EMAILS, lower-cased, once each, for email and push", () => {
    expect(ownerRecipients(" Owner@Example.com, second@example.com;owner@example.com nonsense")).toEqual([
      { email: "owner@example.com", access: { owner: true }, channels: ["email", "push"] },
      { email: "second@example.com", access: { owner: true }, channels: ["email", "push"] },
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
    expect(itemsFor(person({ bills: "see" }), loaded).map((i) => i.id)).toEqual(["bill-item:1"]);
    expect(itemsFor(person({}), loaded)).toEqual([]);
  });
});

describe("a shared person as a recipient (N.5, C144)", () => {
  const owners = new Set(["owner@example.com"]);
  const row = (over: Partial<Parameters<typeof personRecipient>[0]> = {}) => ({ email: "Friend@Example.com", status: "active", notificationsEnabled: true, grants: [{ area: "bills", level: "see" }], ...over });

  it("is push only, with the access their grants give", () => {
    expect(personRecipient(row(), owners)).toEqual({ email: "friend@example.com", access: { owner: false, grants: { bills: "see" } }, channels: ["push"] });
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

describe("what the notifications page says", () => {
  it("lists a topic for every section a shared person can be told about", async () => {
    const { SOURCE_AREA } = await import("@/features/reminders/sources");
    const told = new Set(Object.values(SOURCE_AREA).filter((a) => a !== "owner"));
    expect(new Set(TOPICS.map((t) => t.area))).toEqual(told);
  });

  it("follows the grants, and 'readings due' needs Add", () => {
    expect(topicsFor({ owner: false, grants: {} })).toEqual([]);
    expect(topicsFor({ owner: false, grants: { bills: "see" } }).map((t) => t.key)).toEqual(["bills"]);
    expect(topicsFor({ owner: false, grants: { electricity_readings: "see" } }).map((t) => t.key)).toEqual(["slab"]);
    expect(topicsFor({ owner: false, grants: { electricity_readings: "add" } }).map((t) => t.key)).toEqual(["readings-due", "slab"]);
    expect(topicsFor({ owner: true })).toHaveLength(TOPICS.length);
  });

  it("matches what the run sends: every topic's section and level is one the run filters by", () => {
    for (const t of TOPICS) {
      const sees = person({ [t.area]: t.level });
      // Holding the topic's grant is enough to hear the section's items or events.
      expect(topicsFor(sees.access).map((x) => x.key)).toContain(t.key);
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
