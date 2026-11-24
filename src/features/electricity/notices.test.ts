import { describe, expect, it } from "vitest";
import type { ElectricityBill, ElectricityMeter, ElectricityReading } from "@/db/schema";
import { planNotifications, previewUpcoming } from "@/features/notifications/planner";
import { DEFAULT_RULES, type HubRules } from "@/features/settings/rules";
import { addDays } from "@/lib/dates";
import { electricityEvents } from "./notices";

// Everything here is made up (public repo).
const rules: HubRules = { ...DEFAULT_RULES, lowUnits: 120, highUnits: 180, nearUnits: 15, checkEveryDays: 5, billingCycleDays: 30 };
const none = new Set<string>();
const STAMP = new Date("2026-01-01T00:00:00Z");

const meter = (id: string, name: string): ElectricityMeter => ({ id, name, accountNumber: "DEMO-ACCOUNT-0042", notes: "Spare key under the pot", archivedAt: null, createdAt: STAMP, updatedAt: STAMP });
const bill = (meterId: string, readingDate: string, currentKwh: number): ElectricityBill => ({
  id: `bill-${meterId}-${readingDate}`,
  meterId,
  billDate: readingDate,
  readingDate,
  previousReading: "0.00",
  currentReading: currentKwh.toFixed(2),
  units: "100.00",
  amount: "4250.00",
  dueDate: addDays(readingDate, 14),
  paidDate: null,
  notes: null,
  createdAt: STAMP,
  updatedAt: STAMP,
});
let n = 0;
const reading = (meterId: string, readingDate: string, kwh: number): ElectricityReading => ({
  id: `reading-${++n}`,
  meterId,
  readingDate,
  value: kwh.toFixed(2),
  source: "manual",
  note: null,
  replacedFinalValue: null,
  createdAt: new Date(STAMP.getTime() + n * 1000),
  updatedAt: STAMP,
});

const A = meter("a", "Meter A");
const B = meter("b", "Meter B");

const events = (today: string, bills: ElectricityBill[], readings: ElectricityReading[], meters = [A]) => electricityEvents({ meters, bills, readings, rules, today });
const kinds = (list: ReturnType<typeof events>) => list.filter((e) => e.event.startsWith("slab")).map((e) => e.event);

describe("slab limit events", () => {
  const cycle = bill("a", "2026-11-01", 1000);

  it("says nothing while a meter is far from its limit, or while its usage is unknown", () => {
    expect(kinds(events("2026-11-10", [cycle], [reading("a", "2026-11-09", 1040)]))).toEqual([]);
    expect(kinds(events("2026-11-10", [], [reading("a", "2026-11-09", 1040)]))).toEqual([]);
    expect(kinds(events("2026-11-10", [cycle], []))).toEqual([]);
  });

  it("near: 108 of 120 units used, 12 left, and the days to the bill", () => {
    const [near] = events("2026-11-20", [cycle], [reading("a", "2026-11-19", 1108)]).filter((e) => e.event === "slab-near");
    expect(near.title).toBe("108 of 120 units used");
    expect(near.body).toBe("Meter A · 12 left, 11 days to the bill");
    expect(near.key).toBe("slab:a:near:2026-11-01");
    expect([near.from, near.until, near.anchor]).toEqual(["2026-11-20", "2026-11-20", "2026-11-01"]);
  });

  it("over: a second meter crossing the low slab while the other already holds the high one", () => {
    const readings = [reading("a", "2026-11-19", 1130), reading("b", "2026-11-19", 2125)];
    const list = events("2026-11-20", [bill("a", "2026-11-01", 1000), bill("b", "2026-11-01", 2000)], readings, [A, B]);
    const over = list.filter((e) => e.event === "slab-over");
    expect(over).toHaveLength(1);
    expect(over[0].title).toBe("Over the 120 unit limit");
    expect(over[0].body).toBe("Meter B · 5 over, 11 days to the bill");
    expect(over[0].key).toBe("slab:b:over:2026-11-01");
    // The high meter, inside its 180, says nothing.
    expect(list.some((e) => e.key.startsWith("slab:a:"))).toBe(false);
  });

  it("leaves out the days to the bill once the cycle is over", () => {
    const [near] = events("2026-12-05", [cycle], [reading("a", "2026-12-04", 1110)]).filter((e) => e.event === "slab-near");
    expect(near.body).toBe("Meter A · 10 left");
  });

  it("near and over each go once per cycle per meter; a new cycle starts fresh; no change sends nothing", () => {
    const used = new Set<string>();
    const sent: string[] = [];
    const run = (today: string, bills: ElectricityBill[], readings: ElectricityReading[]) => {
      const plan = planNotifications({ events: events(today, bills, readings), items: [], today, usedKeys: used });
      for (const notice of plan.notices) {
        used.add(notice.dedupeKey);
        sent.push(`${today} ${notice.event}`);
      }
    };
    const r1 = reading("a", "2026-11-19", 1108);
    run("2026-11-20", [cycle], [r1]); // near: sent
    run("2026-11-20", [cycle], [r1]); // a second run the same day: nothing
    run("2026-11-21", [cycle], [r1]); // no new usage: nothing
    const r2 = reading("a", "2026-11-21", 1112);
    run("2026-11-22", [cycle], [r1, r2]); // still near: nothing again
    const r3 = reading("a", "2026-11-23", 1190);
    run("2026-11-24", [cycle], [r1, r2, r3]); // crossed the high slab as the high meter: 190 of 180
    run("2026-11-25", [cycle], [r1, r2, r3]); // nothing again
    // The next bill starts a new cycle: near fires again.
    const next = bill("a", "2026-12-01", 1190);
    run("2026-12-10", [cycle, next], [r1, r2, r3, reading("a", "2026-12-09", 1190 + 110)]);
    expect(sent).toEqual(["2026-11-20 slab-near", "2026-11-24 slab-over", "2026-12-10 slab-near"]);
  });

  it("the title and the body agree at the edges: rounded down, exactly the margin, exactly the limit, 0.01 over", () => {
    const slabOf = (kwh: number, bills = [cycle], meters = [A], readings = [reading("a", "2026-11-19", 1000 + kwh)]) =>
      events("2026-11-20", bills, readings, meters)
        .filter((e) => e.event.startsWith("slab"))
        .map((e) => `${e.event} ${e.title} / ${e.body.split(" · ")[1].split(",")[0]}`);
    // Just outside the 15-unit margin: nothing. Exactly on it: near.
    expect(slabOf(104.99)).toEqual([]);
    expect(slabOf(105)).toEqual(["slab-near 105 of 120 units used / 15 left"]);
    // 119.6 is "119 of 120" and "0 left", never "120 of 120" with "0 left".
    expect(slabOf(119.6)).toEqual(["slab-near 119 of 120 units used / 0 left"]);
    // Exactly the limit is still within it.
    expect(slabOf(120)).toEqual(["slab-near 120 of 120 units used / 0 left"]);
    // 0.01 over, on a meter held to the low slab (the other meter already holds the high one).
    const two = [bill("a", "2026-11-01", 1000), bill("b", "2026-11-01", 2000)];
    const over = events("2026-11-20", two, [reading("a", "2026-11-19", 1130), reading("b", "2026-11-19", 2120.01)], [A, B]);
    expect(over.filter((e) => e.event === "slab-over").map((e) => `${e.title} / ${e.body}`)).toEqual(["Over the 120 unit limit / Meter B · 1 over, 11 days to the bill"]);
  });

  it("the role flips with the readings: the most-used meter past the low slab is judged against the high one, the other against the low", () => {
    const two = [bill("a", "2026-11-01", 1000), bill("b", "2026-11-01", 2000)];
    const slabs = (a: number, b: number) =>
      events("2026-11-20", two, [reading("a", "2026-11-19", 1000 + a), reading("b", "2026-11-19", 2000 + b)], [A, B])
        .filter((e) => e.event.startsWith("slab"))
        .map((e) => e.key.split(":").slice(1, 3).join(" "));
    // B crosses 120 first: it holds the high slab (125 of 180: nothing to say), A is judged against 120.
    expect(slabs(80, 125)).toEqual([]);
    expect(slabs(110, 125)).toEqual(["a near"]);
    // Then A becomes the most-used meter: A is the high one, and B, at 125, is now over the low limit.
    expect(slabs(140, 125)).toEqual(["b over"]);
  });

  it("is about today only: it never appears in a preview of later days", () => {
    const list = events("2026-11-20", [cycle], [reading("a", "2026-11-19", 1108)]).filter((e) => e.event.startsWith("slab"));
    const days = previewUpcoming([], "2026-11-20", none, 10, undefined, list);
    expect(days.map((d) => d.date)).toEqual(["2026-11-20"]);
  });
});

describe("meter reading overdue events", () => {
  it("is due `checkEveryDays` after the last reading and goes once, then stops", () => {
    const list = events("2026-11-16", [], [reading("a", "2026-11-15", 1000)]);
    const [due] = list.filter((e) => e.event === "reading-due");
    expect(due.title).toBe("Meter reading due");
    expect(due.body).toBe("Meter A");
    expect(due.key).toBe("reading-due:a:2026-11-15");
    expect(due.from).toBe("2026-11-20");

    const days = previewUpcoming([], "2026-11-16", none, 30, undefined, list);
    expect(days.map((d) => d.date)).toEqual(["2026-11-20"]);
  });

  it("starts over from the next reading: the old one stops, a new one is due 5 days after it", () => {
    const first = reading("a", "2026-11-15", 1000);
    const used = new Set<string>();
    const sent: string[] = [];
    for (const [today, readings] of [
      ["2026-11-19", [first]],
      ["2026-11-20", [first]], // 5 days after: due
      ["2026-11-21", [first]], // already sent
      ["2026-11-22", [first, reading("a", "2026-11-22", 1010)]], // someone reads: stops
      ["2026-11-26", [first, reading("a", "2026-11-22", 1010)]], // 4 days: not yet
      ["2026-11-27", [first, reading("a", "2026-11-22", 1010)]], // 5 days after the new reading: due again
    ] as const) {
      const plan = planNotifications({ events: events(today, [], [...readings]), items: [], today, usedKeys: used });
      for (const notice of plan.notices) {
        used.add(notice.dedupeKey);
        sent.push(today);
      }
    }
    expect(sent).toEqual(["2026-11-20", "2026-11-27"]);
  });

  it("catches up for a week after it is due, and not for a meter forgotten for months", () => {
    const list = events("2026-11-16", [], [reading("a", "2026-11-15", 1000)]);
    expect(planNotifications({ events: list, items: [], today: "2026-11-27", usedKeys: none }).notices).toHaveLength(1);
    expect(planNotifications({ events: list, items: [], today: "2026-11-28", usedKeys: none }).notices).toHaveLength(0);
    // Never read at all: nothing to measure from.
    expect(events("2026-11-16", [], [])).toEqual([]);
  });
});

describe("what the messages may say", () => {
  it("never carries an account number, a note, an amount or a reading", () => {
    const readings = [reading("a", "2026-11-19", 1108), reading("b", "2026-11-19", 2125), reading("a", "2026-11-10", 1050)];
    const list = events("2026-11-20", [bill("a", "2026-11-01", 1000), bill("b", "2026-11-01", 2000)], readings, [A, B]);
    const text = list.map((e) => `${e.title}\n${e.body}\n${e.href}`).join("\n");
    expect(text).toContain("Meter A");
    expect(text).not.toMatch(/DEMO-ACCOUNT|0042|Spare key|4250|4,250|LKR|Rs/);
    expect(text).not.toMatch(/1108|1108\.00|2125|1050/);
  });
});
