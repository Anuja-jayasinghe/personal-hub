import { describe, expect, it } from "vitest";
import type { NoticeEvent, ReminderItem } from "@/features/reminders/engine";
import { accessRequestEvent } from "@/features/people/notices";
import { addDays } from "@/lib/dates";
import { planNotifications, previewUpcoming } from "./planner";
import { EVENT_WINDOW_DAYS, NOTIFICATION_STEPS } from "./steps";

/**
 * Events happening now (N.4, C142) in the planner: the same C139 rules as the dated notices. Made-up data only.
 */
const TODAY = "2026-11-23";
const none = new Set<string>();

const slab = (key: string, today = TODAY): NoticeEvent => ({ event: "slab-near", key, anchor: "2026-11-01", from: today, until: today, href: "/electricity", title: "108 of 120 units used", body: "Meter A · 12 left" });
const person = (id: string, createdAt = new Date("2026-11-23T05:00:00Z")) => accessRequestEvent({ id, createdAt }, "Asia/Colombo");
const task: ReminderItem = { id: "task:t1", title: "Water the plants", dueDate: TODAY, href: "/tasks", kind: "task", notice: { what: "Task" } };

describe("the step map", () => {
  it("has the three new kinds, each one push and nothing else", () => {
    for (const kind of ["slab-near", "slab-over", "reading-due", "access-request"] as const) {
      expect(NOTIFICATION_STEPS[kind].steps).toEqual([{ step: "now", channel: "push" }]);
    }
  });
});

describe("rule 1 and 4: nothing new, nothing sent; once per key", () => {
  it("sends nothing without events, and nothing for an event outside its window", () => {
    expect(planNotifications({ events: [], items: [], today: TODAY, usedKeys: none })).toEqual({ notices: [], messages: [], held: 0 });
    expect(planNotifications({ events: [slab("k", addDays(TODAY, 1))], items: [], today: TODAY, usedKeys: none }).notices).toEqual([]);
  });

  it("sends an event once: its key is used afterwards, and the same key twice in one plan counts once", () => {
    const first = planNotifications({ events: [slab("k"), slab("k")], items: [], today: TODAY, usedKeys: none });
    expect(first.notices).toHaveLength(1);
    expect(first.notices[0]).toMatchObject({ step: "now", channel: "push", dedupeKey: "k", dueDate: "2026-11-01" });
    expect(planNotifications({ events: [slab("k")], items: [], today: TODAY, usedKeys: new Set(["k"]) }).notices).toEqual([]);
  });
});

describe("rule 4: one message per day per channel, several items batched", () => {
  it("batches an event with a dated push into one push", () => {
    const plan = planNotifications({ events: [slab("k")], items: [task], today: TODAY, usedKeys: none });
    expect(plan.messages).toHaveLength(1);
    expect(plan.messages[0].channel).toBe("push");
    expect(plan.messages[0].notices.map((n) => n.event).sort()).toEqual(["slab-near", "task"]);
  });

  it("holds events back when a push already went today, and sends them the next day while the window lasts", () => {
    const e = person("p1");
    const held = planNotifications({ events: [e], items: [], today: TODAY, usedKeys: none, channelsUsedToday: new Set(["push"]) });
    expect(held).toEqual({ notices: [], messages: [], held: 1 });
    const next = planNotifications({ events: [e], items: [], today: addDays(TODAY, 1), usedKeys: none });
    expect(next.notices).toHaveLength(1);
    // After its window it is dropped, not sent late.
    expect(planNotifications({ events: [e], items: [], today: addDays(TODAY, EVENT_WINDOW_DAYS + 1), usedKeys: none }).notices).toEqual([]);
  });

  it("several sign-up requests are one line, and say nothing about who", () => {
    const plan = planNotifications({ events: [person("p1"), person("p2")], items: [], today: TODAY, usedKeys: none });
    expect(plan.messages).toHaveLength(1);
    expect(plan.messages[0]).toMatchObject({ title: "2 people asked for access", body: "Open People to review", href: "/settings/people" });
  });

  it("a sign-up request next to other pushes is one line among them", () => {
    const plan = planNotifications({ events: [person("p1"), person("p2")], items: [task], today: TODAY, usedKeys: none });
    expect(plan.messages).toHaveLength(1);
    expect(plan.messages[0].title).toBe("2 things need you");
    expect(plan.messages[0].body.split("\n")).toEqual(["Task due today", "Plus 2 requests in People"]);
    expect(plan.messages[0].href).toBe("/reminders");
    // One request: one short line, and still no name.
    const one = planNotifications({ events: [person("p1")], items: [task], today: TODAY, usedKeys: none });
    expect(one.messages[0].body.split("\n")).toEqual(["Task due today", "Plus a request in People"]);
  });

  it("counts requests the cap left out, so the message says the true number", () => {
    const plan = planNotifications({ events: [{ ...person("p1"), extra: 10 }, person("p2")], items: [], today: TODAY, usedKeys: none });
    expect(plan.messages[0].title).toBe("12 people asked for access");
  });
});

describe("where a batched push opens", () => {
  const near = (key: string, event: NoticeEvent["event"] = "slab-near"): NoticeEvent => ({ ...slab(key), event });
  const due = (key: string): NoticeEvent => ({ ...slab(key), event: "reading-due", title: "Meter reading due", body: "Meter A" });

  it("when every notice opens the same page, the batch opens it (electricity only: /electricity)", () => {
    const plan = planNotifications({ events: [near("a"), due("b")], items: [], today: TODAY, usedKeys: none });
    expect(plan.messages[0].title).toBe("2 things need you");
    expect(plan.messages[0].href).toBe("/electricity");
  });

  it("otherwise it opens the list of things", () => {
    expect(planNotifications({ events: [near("a")], items: [task], today: TODAY, usedKeys: none }).messages[0].href).toBe("/reminders");
    expect(planNotifications({ events: [near("a"), person("p1")], items: [], today: TODAY, usedKeys: none }).messages[0].href).toBe("/reminders");
  });
});

describe("the budget", () => {
  it("a month of busy days stays at one push a day and well under the budget", () => {
    const events = [person("p1"), person("p2", new Date("2026-11-30T05:00:00Z")), slab("slab:a:near:2026-11-01"), slab("slab:b:near:2026-11-01")];
    const days = previewUpcoming([task, { ...task, id: "task:t2", dueDate: addDays(TODAY, 9) }], TODAY, none, 30, undefined, events);
    const pushes = days.flatMap((d) => d.messages.filter((m) => m.channel === "push"));
    expect(days.every((d) => d.messages.length <= 1)).toBe(true);
    expect(pushes.length).toBeLessThanOrEqual(8);
    // Every notice goes out once.
    const keys = pushes.flatMap((m) => m.notices.map((n) => n.dedupeKey));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("what a sign-up request may say", () => {
  it("carries no name, no email and no id: only the fixed words and a path on the hub", () => {
    const e = person("11111111-2222-3333-4444-555555555555");
    expect(e.title).toBe("Someone asked for access");
    expect(e.body).toBe("Open People to review");
    expect(e.href).toBe("/settings/people");
    expect(`${e.title} ${e.body} ${e.href}`).not.toMatch(/@|11111111|\./);
    expect(e.key).toBe("access-request:11111111-2222-3333-4444-555555555555");
  });
});
