import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/read";
import { cheques } from "@/db/schema";
import { previewUpcoming } from "@/features/notifications/planner";
import { addDays, addMonthsToDate } from "@/lib/dates";
import { makeTestDb } from "@/test/pglite";

/**
 * The cheques reminder source (issue #178, DECISIONS C158) through the real source, the real loader and the
 * real planner, on an in-memory database. Everything here is made up (public repo). `readDb()` throws, so a
 * source that reached for it instead of the database it was given would fail.
 */
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/db/read", () => ({
  readDb: async () => {
    throw new Error("readDb must not be used when a database is passed in");
  },
}));

const { loadSources, reminderSources, SOURCE_AREA } = await import("./sources");

const TODAY = "2026-11-23";
const PRIVATE = /Zebra|Quokka|184,?250|99,?999|roof|700123|700124|LKR/i;
let db: Db;

beforeAll(async () => {
  ({ db } = await makeTestDb());
  await db.insert(cheques).values([
    { fromParty: "Zebra Hardware (Pvt) Ltd", amount: "184250.50", bank: "Zebra Bank", chequeNumber: "700123", chequeDate: addDays(TODAY, 3), note: "for the roof job", status: "waiting" },
    { fromParty: "Quokka Traders", amount: "99999.00", chequeNumber: "700124", chequeDate: addDays(TODAY, 2), status: "deposited", depositedOn: TODAY },
  ]);
}, 60_000);

const chequeItems = async (today = TODAY) => {
  const { loaded, failedSources } = await loadSources(reminderSources, { db, today });
  expect(failedSources).toEqual([]);
  return loaded.find((l) => l.key === "cheques")!;
};

describe("the cheques source", () => {
  it("only a waiting cheque reminds: on the cheque date, and on the stale date six months later", async () => {
    const { items } = await chequeItems();
    expect(items.map((i) => [i.id.split(":")[0], i.dueDate])).toEqual([
      ["cheque", addDays(TODAY, 3)],
      ["cheque-stale", addMonthsToDate(addDays(TODAY, 3), 6)],
    ]);
    // The owner's own screen may name who and the amount; the deposited cheque is not listed at all.
    expect(items[0].title).toMatch(/Zebra Hardware/);
    expect(items[0].title).toMatch(/184,250\.50/);
    expect(items.some((i) => /Quokka|700124/.test(i.title))).toBe(false);
    for (const i of items) expect(i.href).toMatch(/^\/cheques#cheque-[0-9a-f-]{36}$/);
  });

  it("the cheque number and the note are never in a reminder title", async () => {
    const { items } = await chequeItems();
    for (const i of items) expect(i.title).not.toMatch(/700123|roof|Zebra Bank/);
  });

  it("stays on the list, overdue, every day after the cheque date until it is deposited", async () => {
    const { computeReminders } = await import("./engine");
    const { items } = await chequeItems();
    const on = (offset: number) => computeReminders(items, addDays(TODAY, offset), [30, 14, 7, 1, 0]).filter((r) => r.item.id.startsWith("cheque:"));
    expect(on(0)[0].daysUntil).toBe(3);
    expect(on(3)[0].level).toBe("today");
    expect(on(4)[0].level).toBe("overdue");
    expect(on(40)[0].level).toBe("overdue");
    expect(on(120)[0].level).toBe("overdue");
  });

  it("is owners only: filed under 'owner', so a shared person with every grant never gets it", async () => {
    const { itemsFor } = await import("@/features/notifications/recipients");
    const { allowsSourceArea, accessFromGrants, AREAS } = await import("@/features/people/access");
    const loaded = await chequeItems();
    expect(loaded.area).toBe("owner");
    expect(SOURCE_AREA.cheques).toBe("owner");
    const everything = accessFromGrants(AREAS.map((a) => ({ area: a.key, level: "edit" })));
    expect(allowsSourceArea(everything, loaded.area)).toBe(false);
    expect(allowsSourceArea({ owner: true }, loaded.area)).toBe(true);
    const shared = { email: "p@example.com", access: everything, channels: ["push"] as const, listHref: "/reminders" };
    expect(itemsFor(shared, [loaded])).toEqual([]);
    const owner = { email: "o@example.com", access: { owner: true as const }, channels: ["email", "push"] as const, listHref: "/reminders" };
    expect(itemsFor(owner, [loaded]).some((i) => i.id.startsWith("cheque:"))).toBe(true);
  });

  it("a source nobody mapped is owners-only too (fails closed)", async () => {
    const { loaded } = await loadSources([{ key: "something-new", label: "New", load: async () => [] }], { db, today: TODAY });
    expect(loaded[0].area).toBe("owner");
  });

  it("a notification about a cheque says only 'Cheque': no name, amount, bank, number or note", async () => {
    const { items } = await chequeItems();
    for (const i of items) expect(i.notice).toEqual({ what: "Cheque" });

    // Every day from today until after the stale date, a run that never missed.
    const days = previewUpcoming(items, TODAY, new Set(), 220);
    const text = days
      .flatMap((d) => d.messages.flatMap((m) => [m.title, m.body, m.href, ...m.notices.flatMap((n) => [n.title, n.body, n.dedupeKey, n.href])]))
      .join("\n");
    expect(text).toContain("Cheque to deposit");
    expect(text).toContain("Cheque goes stale");
    expect(text).not.toMatch(PRIVATE);

    // C139: at most three notices per item. The deposit notices: an email (caught up, inside its week), a push on the day, a push the day after.
    const notices = days.flatMap((d) => d.messages.flatMap((m) => m.notices));
    for (const i of items) expect(notices.filter((n) => n.item.id === i.id).length).toBeLessThanOrEqual(3);
    expect(notices.filter((n) => n.item.id === items[0].id).map((n) => [n.step, n.channel, n.daysUntil])).toEqual([
      ["plan", "email", 3],
      ["act", "push", 0],
      ["overdue", "push", -1],
    ]);
    expect(notices.filter((n) => n.item.id === items[1].id).map((n) => [n.step, n.channel])).toEqual([
      ["plan", "email"],
      ["act", "push"],
      ["overdue", "push"],
    ]);
  });
});
