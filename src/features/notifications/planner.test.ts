import { describe, expect, it } from "vitest";
import type { ReminderItem } from "@/features/reminders/engine";
import { addDays, daysBetween } from "@/lib/dates";
import { planNotifications, previewUpcoming, type Message } from "./planner";
import { NOTIFICATION_STEPS, OVERDUE_WINDOW_DAYS, dedupeKey, eventOf, type EventKey } from "./steps";

// Everything here is made up (public repo).
const TODAY = "2026-11-23";
const none = new Set<string>();

function renewal(dueDate: string, id = "renewal:r1", who = "Silver car", what = "Insurance"): ReminderItem {
  return { id, title: `${what} · ${who}`, dueDate, href: "/vehicles/v1?tab=renewals", kind: "renewal", ownerId: "v1", notice: { what, who } };
}
function service(dueDate: string, id = "service:s1"): ReminderItem {
  return { id, title: "Full service · Silver car", dueDate, href: "/vehicles/v1?tab=services", kind: "service", notice: { what: "Full service", who: "Silver car" } };
}
function electricity(dueDate: string, id = "electricity-bill:e1"): ReminderItem {
  return { id, title: "Electricity bill · Account DEMO-0001 · LKR 4,250.00", dueDate, href: "/bills#electricity-bill-e1", kind: "bill", notice: { what: "Electricity bill", who: "Main house" } };
}
function bill(dueDate: string, id = "bill-item:b1", autopay = false): ReminderItem {
  return { id, title: "Internet · LKR 3,990.00", dueDate, href: "/bills", kind: autopay ? "autopay" : "bill", notice: { what: "Internet" } };
}
function task(dueDate: string, id = "task:t1"): ReminderItem {
  return { id, title: "Water the plants", dueDate, href: "/tasks", kind: "task", notice: { what: "Task", who: "Water the plants" } };
}

/** Runs the planner every day from `from` for `days` days, keeping the used keys like the send log. */
function simulate(items: ReminderItem[], from: string, days: number) {
  return previewUpcoming(items, from, none, days).flatMap((d) => d.messages.flatMap((m) => m.notices.map((n) => ({ date: d.date, step: n.step, channel: n.channel, daysUntil: n.daysUntil }))));
}

describe("rule 1: nothing new, nothing sent", () => {
  it("sends nothing when nothing is in a window", () => {
    const plan = planNotifications({ items: [renewal(addDays(TODAY, 45)), service(addDays(TODAY, 20)), task(addDays(TODAY, 3))], today: TODAY, usedKeys: none });
    expect(plan.notices).toEqual([]);
    expect(plan.messages).toEqual([]);
  });

  it("sends nothing when there are no items (no digest, no all clear)", () => {
    expect(planNotifications({ items: [], today: TODAY, usedKeys: none })).toEqual({ notices: [], messages: [], held: 0 });
  });

  it("never repeats a notice whose key is used", () => {
    const item = renewal(addDays(TODAY, 30));
    const first = planNotifications({ items: [item], today: TODAY, usedKeys: none });
    expect(first.notices).toHaveLength(1);
    const used = new Set(first.notices.map((n) => n.dedupeKey));
    for (let i = 0; i < 28; i++) {
      // Every later day inside the plan window: still nothing new.
      expect(planNotifications({ items: [item], today: addDays(TODAY, i), usedKeys: used }).notices.filter((n) => n.step === "plan")).toEqual([]);
    }
  });
});

describe("rule 2: at most three notices per item, ever", () => {
  it("no event has more than one email, one act-now push and one overdue push", () => {
    for (const rule of Object.values(NOTIFICATION_STEPS)) {
      const steps = rule.steps.map((s) => s.step);
      expect(steps.length).toBeLessThanOrEqual(3);
      expect(new Set(steps).size).toBe(steps.length);
      for (const s of rule.steps) expect(s.channel).toBe(s.step === "plan" ? "email" : "push");
    }
  });

  it("a renewal gets its email 30 days before, a push the day before and one the first day after, then silence", () => {
    const due = "2027-01-10";
    const sent = simulate([renewal(due)], addDays(due, -40), 60);
    expect(sent).toEqual([
      { date: addDays(due, -30), step: "plan", channel: "email", daysUntil: 30 },
      { date: addDays(due, -1), step: "act", channel: "push", daysUntil: 1 },
      { date: addDays(due, 1), step: "overdue", channel: "push", daysUntil: -1 },
    ]);
  });

  it("a service: email 14 days before, push on the day, nothing overdue", () => {
    const due = "2027-01-10";
    expect(simulate([service(due)], addDays(due, -20), 40)).toEqual([
      { date: addDays(due, -14), step: "plan", channel: "email", daysUntil: 14 },
      { date: due, step: "act", channel: "push", daysUntil: 0 },
    ]);
  });

  it("an electricity bill: email 7 days before, push the day before, push on the first day overdue", () => {
    const due = "2027-01-10";
    expect(simulate([electricity(due)], addDays(due, -10), 30)).toEqual([
      { date: addDays(due, -7), step: "plan", channel: "email", daysUntil: 7 },
      { date: addDays(due, -1), step: "act", channel: "push", daysUntil: 1 },
      { date: addDays(due, 1), step: "overdue", channel: "push", daysUntil: -1 },
    ]);
  });

  it("a bill paid by hand: no email, push the day before and the first day overdue", () => {
    const due = "2027-01-10";
    expect(simulate([bill(due)], addDays(due, -10), 30)).toEqual([
      { date: addDays(due, -1), step: "act", channel: "push", daysUntil: 1 },
      { date: addDays(due, 1), step: "overdue", channel: "push", daysUntil: -1 },
    ]);
  });

  it("a bill on autopay: nothing at all", () => {
    const due = "2027-01-10";
    expect(simulate([bill(due, "bill-item:b2", true)], addDays(due, -40), 60)).toEqual([]);
  });

  it("a task with a due date: one push on the day", () => {
    const due = "2027-01-10";
    expect(simulate([task(due)], addDays(due, -10), 30)).toEqual([{ date: due, step: "act", channel: "push", daysUntil: 0 }]);
  });

  it("items from unknown sources send nothing", () => {
    expect(eventOf({ id: "cheque:1", kind: "cheque" })).toBeNull();
    expect(planNotifications({ items: [{ ...task(TODAY), id: "cheque:1" }], today: TODAY, usedKeys: none }).notices).toEqual([]);
  });

  it("maps the real source ids and kinds to events", () => {
    const cases: [ReminderItem, EventKey][] = [
      [renewal(TODAY), "renewal"],
      [service(TODAY), "service"],
      [electricity(TODAY), "electricity-bill"],
      [bill(TODAY), "bill"],
      [{ ...bill(TODAY), kind: "subscription" }, "bill"],
      [bill(TODAY, "bill-item:b2", true), "autopay"],
      [task(TODAY), "task"],
    ];
    for (const [item, event] of cases) expect(eventOf(item)).toBe(event);
  });
});

describe("rule 3: one channel per notice", () => {
  it("each notice has one channel, and an email and a push on the same day never share a notice", () => {
    const plan = planNotifications({ items: [renewal(addDays(TODAY, 30)), electricity(addDays(TODAY, 1))], today: TODAY, usedKeys: none });
    const email = plan.messages.find((m) => m.channel === "email")!;
    const push = plan.messages.find((m) => m.channel === "push")!;
    expect(email.notices.map((n) => n.item.id)).toEqual(["renewal:r1"]);
    expect(push.notices.map((n) => n.item.id)).toEqual(["electricity-bill:e1"]);
    expect(new Set(plan.notices.map((n) => n.dedupeKey)).size).toBe(plan.notices.length);
  });
});

describe("rule 4: one message per day per channel per recipient", () => {
  it("batches several emails into one", () => {
    const items = [renewal(addDays(TODAY, 30)), renewal(addDays(TODAY, 20), "renewal:r2", "Blue bike", "Revenue license"), service(addDays(TODAY, 14))];
    const plan = planNotifications({ recipient: "owner@example.com", items, today: TODAY, usedKeys: none });
    expect(plan.messages).toHaveLength(1);
    expect(plan.messages[0]).toMatchObject({ recipient: "owner@example.com", channel: "email", title: "hub · 3 things coming up", href: "/reminders" });
    expect(plan.messages[0].notices.map((n) => n.daysUntil)).toEqual([14, 20, 30]);
  });

  it("batches several pushes into one", () => {
    const plan = planNotifications({ items: [renewal(addDays(TODAY, 1)), electricity(addDays(TODAY, -1)), task(TODAY)], today: TODAY, usedKeys: none });
    expect(plan.messages).toHaveLength(1);
    const [push] = plan.messages;
    expect(push.channel).toBe("push");
    expect(push.title).toBe("3 things need you");
    expect(push.body.split("\n")).toEqual(["Electricity bill overdue · Main house", "Task due today · Water the plants", "Insurance ends tomorrow · Silver car"]);
  });

  it("holds a channel already used today instead of sending a second message", () => {
    const items = [renewal(addDays(TODAY, 30)), task(TODAY)];
    const plan = planNotifications({ items, today: TODAY, usedKeys: none, channelsUsedToday: new Set(["push"]) });
    expect(plan.messages.map((m) => m.channel)).toEqual(["email"]);
    expect(plan.held).toBe(1);
  });
});

describe("catch-up when a run was missed", () => {
  it("still sends the plan-ahead email inside the window while more than one day remains", () => {
    for (const days of [29, 10, 2]) {
      const plan = planNotifications({ items: [renewal(addDays(TODAY, days))], today: TODAY, usedKeys: none });
      expect(plan.notices.map((n) => n.step)).toEqual(["plan"]);
    }
  });

  it("an item that first appears inside its window still gets the email", () => {
    const due = "2027-01-10";
    const sent = simulate([renewal(due)], addDays(due, -12), 5);
    expect(sent).toEqual([{ date: addDays(due, -12), step: "plan", channel: "email", daysUntil: 12 }]);
  });

  it("drops the plan-ahead email with one day or less left (the push covers it)", () => {
    expect(planNotifications({ items: [renewal(addDays(TODAY, 1))], today: TODAY, usedKeys: none }).notices.map((n) => n.step)).toEqual(["act"]);
    expect(planNotifications({ items: [electricity(TODAY)], today: TODAY, usedKeys: none }).notices.map((n) => n.step)).toEqual(["act"]);
  });

  it("sends a missed day-before push on the day itself, never later", () => {
    const today = planNotifications({ items: [renewal(TODAY)], today: TODAY, usedKeys: none });
    expect(today.notices.map((n) => [n.step, n.title])).toEqual([["act", "Insurance ends today"]]);
    const later = planNotifications({ items: [renewal(addDays(TODAY, -1))], today: TODAY, usedKeys: none });
    expect(later.notices.map((n) => n.step)).toEqual(["overdue"]);
  });

  it("an on-the-day push is only sent on the day", () => {
    expect(planNotifications({ items: [task(addDays(TODAY, -1))], today: TODAY, usedKeys: none }).notices).toEqual([]);
    expect(planNotifications({ items: [service(addDays(TODAY, -1))], today: TODAY, usedKeys: none }).notices).toEqual([]);
  });

  it("sends the overdue push once, on the first run it is overdue, within 7 days", () => {
    const due = addDays(TODAY, -5);
    const first = planNotifications({ items: [bill(due)], today: TODAY, usedKeys: none });
    expect(first.notices.map((n) => n.step)).toEqual(["overdue"]);
    const used = new Set(first.notices.map((n) => n.dedupeKey));
    expect(planNotifications({ items: [bill(due)], today: addDays(TODAY, 1), usedKeys: used }).notices).toEqual([]);
    expect(planNotifications({ items: [bill(addDays(TODAY, -OVERDUE_WINDOW_DAYS))], today: TODAY, usedKeys: none }).notices).toHaveLength(1);
    expect(planNotifications({ items: [bill(addDays(TODAY, -OVERDUE_WINDOW_DAYS - 1))], today: TODAY, usedKeys: none }).notices).toEqual([]);
  });
});

describe("dedupe keys", () => {
  it("are <item.id>:<step>:<dueDate>", () => {
    const plan = planNotifications({ items: [renewal("2026-12-23")], today: TODAY, usedKeys: none });
    expect(plan.notices[0].dedupeKey).toBe("renewal:r1:plan:2026-12-23");
    expect(dedupeKey("task:t1", "act", "2026-11-23")).toBe("task:t1:act:2026-11-23");
  });

  it("a renewed item has a new due date, so it is notified again", () => {
    const old = planNotifications({ items: [electricity(addDays(TODAY, 7))], today: TODAY, usedKeys: none });
    const used = new Set(old.notices.map((n) => n.dedupeKey));
    // Same item id, new due date (next bill / renewed for a year): a new key, a new email.
    const renewed = planNotifications({ items: [electricity(addDays(TODAY, 7 + 30))], today: addDays(TODAY, 30), usedKeys: used });
    expect(renewed.notices).toHaveLength(1);
    expect(renewed.notices[0].dedupeKey).not.toBe(old.notices[0].dedupeKey);
  });

  it("the same item listed twice is notified once", () => {
    const plan = planNotifications({ items: [task(TODAY), task(TODAY)], today: TODAY, usedKeys: none });
    expect(plan.notices).toHaveLength(1);
  });
});

describe("messages", () => {
  it("an email subject reads hub · <what> · <when>", () => {
    const [email] = planNotifications({ items: [renewal("2026-12-23")], today: TODAY, usedKeys: none }).messages;
    expect(email.title).toBe("hub · Insurance · Silver car ends 23 Dec");
    expect(email.body).toContain("Insurance · Silver car ends 23 Dec (in 30 days)");
    expect(email.body).toContain("https://hub.anujajay.com/vehicles/v1?tab=renewals");
    expect(email.href).toBe("/vehicles/v1?tab=renewals");
  });

  it("a push reads like the owner's examples", () => {
    const push = (item: ReminderItem, today = TODAY) => planNotifications({ items: [item], today, usedKeys: none }).messages[0];
    expect(push(renewal(addDays(TODAY, 1)))).toMatchObject({ channel: "push", title: "Insurance ends tomorrow", body: "Silver car" });
    expect(push(electricity(addDays(TODAY, -1)))).toMatchObject({ title: "Electricity bill overdue", body: "Main house" });
    expect(push(renewal(addDays(TODAY, -1)))).toMatchObject({ title: "Insurance has ended", body: "Silver car" });
    expect(push(bill(addDays(TODAY, 1)))).toMatchObject({ title: "Internet due tomorrow", body: "Bills" });
    expect(push(task(TODAY))).toMatchObject({ title: "Task due today", body: "Water the plants" });
  });

  it("never carries an amount, a plate or a document number", () => {
    const leaky: ReminderItem[] = [
      { ...renewal(addDays(TODAY, 30)), title: "Insurance · CAB-1234 · policy PN-998877 · LKR 52,000.00" },
      { ...electricity(addDays(TODAY, 1)), title: "Electricity bill · Account DEMO-0001 · LKR 4,250.00" },
      { ...bill(addDays(TODAY, -1), "bill-item:b9"), title: "Internet · LKR 3,990.00" },
    ];
    const messages: Message[] = previewUpcoming(leaky, TODAY, none, 40).flatMap((d) => d.messages);
    expect(messages.length).toBeGreaterThan(0);
    for (const m of messages) {
      const text = `${m.title}\n${m.body}\n${m.notices.map((n) => `${n.title}\n${n.body}`).join("\n")}`;
      expect(text).not.toMatch(/LKR|CAB-1234|PN-998877|DEMO-0001|\d{1,3}(,\d{3})+/);
    }
  });
});

describe("previewUpcoming", () => {
  it("lists what would go out and when, over the next N days only", () => {
    const items = [renewal(addDays(TODAY, 31)), task(addDays(TODAY, 2)), bill(addDays(TODAY, 40))];
    const days = previewUpcoming(items, TODAY, none, 5);
    expect(days.map((d) => [d.date, d.messages.map((m) => `${m.channel}: ${m.title}`)])).toEqual([
      [addDays(TODAY, 1), ["email: hub · Insurance · Silver car ends 24 Dec"]],
      [addDays(TODAY, 2), ["push: Task due today"]],
    ]);
  });

  it("leaves out what was already sent", () => {
    const used = new Set([dedupeKey("task:t1", "act", addDays(TODAY, 2))]);
    expect(previewUpcoming([task(addDays(TODAY, 2))], TODAY, used, 5)).toEqual([]);
  });
});

describe("rule 5: budget with normal data", () => {
  it("stays around 4 to 8 emails and 4 to 8 pushes in a month", () => {
    const start = "2026-12-01";
    const items: ReminderItem[] = [
      // Five vehicles, three renewals each, spread over the year: two fall in or near this month.
      renewal("2026-12-18", "renewal:a", "Silver car", "Insurance"),
      renewal("2027-01-08", "renewal:b", "Blue bike", "Revenue license"),
      renewal("2027-04-02", "renewal:c", "Red scooter", "Emission test"),
      service("2026-12-27", "service:a"),
      // Two meters with the same billing day, and the next cycle.
      electricity("2026-12-12", "electricity-bill:a"),
      { ...electricity("2026-12-12", "electricity-bill:b"), notice: { what: "Electricity bill", who: "Annex" } },
      // Bills paid by hand, autopay ones, tasks.
      bill("2026-12-05", "bill-item:internet"),
      { ...bill("2026-12-15", "bill-item:phone"), notice: { what: "Phone" } },
      { ...bill("2026-12-20", "bill-item:water"), notice: { what: "Water" } },
      bill("2026-12-10", "bill-item:stream", true),
      bill("2026-12-25", "bill-item:gym", true),
      task("2026-12-09", "task:a"),
      task("2026-12-22", "task:b"),
    ];
    // Bills are paid on time: an item leaves the list once its due date has passed.
    const used = new Set<string>();
    const count = { email: 0, push: 0 };
    for (let i = 0; i < 31; i++) {
      const today = addDays(start, i);
      const open = items.filter((it) => daysBetween(today, it.dueDate) >= 0);
      const plan = planNotifications({ items: open, today, usedKeys: used });
      for (const n of plan.notices) used.add(n.dedupeKey);
      for (const m of plan.messages) count[m.channel]++;
    }
    expect(count.email).toBeGreaterThanOrEqual(2);
    expect(count.email).toBeLessThanOrEqual(8);
    expect(count.push).toBeGreaterThanOrEqual(4);
    expect(count.push).toBeLessThanOrEqual(8);
  });
});
