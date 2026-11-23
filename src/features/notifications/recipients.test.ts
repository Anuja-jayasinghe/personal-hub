import { describe, expect, it } from "vitest";
import type { ReminderItem } from "@/features/reminders/engine";
import { channelModes, parseSwitches } from "./channels";
import { itemsFor, ownerRecipients } from "./recipients";

const item = (id: string): ReminderItem => ({ id, title: id, dueDate: "2026-11-23", href: "/", kind: "task" });

describe("recipients", () => {
  it("are the owners from ALLOWED_EMAILS, lower-cased, once each", () => {
    expect(ownerRecipients(" Owner@Example.com, second@example.com;owner@example.com nonsense")).toEqual([
      { email: "owner@example.com", access: { owner: true } },
      { email: "second@example.com", access: { owner: true } },
    ]);
    expect(ownerRecipients(undefined)).toEqual([]);
  });

  it("owners hear about every source; a person (N.5) only about the sections they may see", () => {
    const loaded = [
      { area: "vehicles" as const, items: [item("renewal:1")] },
      { area: "bills" as const, items: [item("bill-item:1")] },
      { area: "tasks_notes" as const, items: [item("task:1")] },
    ];
    expect(itemsFor({ email: "o@example.com", access: { owner: true } }, loaded).map((i) => i.id)).toEqual(["renewal:1", "bill-item:1", "task:1"]);
    expect(itemsFor({ email: "p@example.com", access: { owner: false, grants: { bills: "see" } } }, loaded).map((i) => i.id)).toEqual(["bill-item:1"]);
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
