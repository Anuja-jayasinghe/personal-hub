import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/read";
import { billItems, billPayments } from "@/db/schema";
import { makeTestDb } from "@/test/pglite";

/**
 * Mark paid (issue #240, C153) on a real in-memory database: a monthly bill that is not on autopay is
 * processed on its bill day and can only be paid after it, so the action refuses earlier, inside its
 * transaction, and records nothing. Every other item is paid whenever. The access check and the clock are
 * fakes; everything here is made up (public repo).
 */
const h = vi.hoisted(() => ({ db: null as unknown as Db, today: "2026-11-24" }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: () => {} }));
vi.mock("@/db", () => ({
  get db() {
    return h.db;
  },
}));
vi.mock("@/lib/auth", () => ({ requireUser: async () => ({}) }));
vi.mock("@/lib/format", async (original) => ({ ...(await original<typeof import("@/lib/format")>()), todayInAppTz: () => h.today }));

const { markBillItemPaid } = await import("./actions");

const slt = { name: "Fibre", kind: "bill" as const, frequency: "monthly" as const, anchorDay: 6, autopay: false, amount: "7500.00" };

async function addItem(over: Partial<typeof billItems.$inferInsert> & { nextDueDate: string | null }) {
  const [row] = await h.db.insert(billItems).values({ ...slt, ...over }).returning();
  return row;
}
const pay = (itemId: string, paidDate = h.today) => {
  const fd = new FormData();
  fd.set("itemId", itemId);
  fd.set("paidDate", paidDate);
  return markBillItemPaid({ ok: false }, fd);
};
const payments = () => h.db.select().from(billPayments);
const dueOf = async (id: string) => (await h.db.select().from(billItems).where(eq(billItems.id, id)))[0].nextDueDate;

beforeEach(async () => {
  ({ db: h.db } = await makeTestDb());
  h.today = "2026-11-24";
}, 60_000);

describe("Mark paid on a monthly bill that is not on autopay", () => {
  it("settles the bill that is payable: 24 Nov, due by 6 Dec, is the 6 Nov bill", async () => {
    const item = await addItem({ nextDueDate: "2026-12-06" });
    expect(await pay(item.id)).toEqual({ ok: true });
    expect((await payments()).map((p) => p.dueDate)).toEqual(["2026-12-06"]);
    expect(await dueOf(item.id)).toBe("2027-01-06");
  });

  it("refuses before the next bill is processed, says why, and records nothing", async () => {
    const item = await addItem({ nextDueDate: "2027-01-06" }); // the 6 Dec bill, payable from 7 Dec
    expect(await pay(item.id)).toEqual({ ok: false, error: "The 6 Dec bill is processed on 6 Dec and can be paid from 7 Dec." });
    expect(await payments()).toEqual([]);
    expect(await dueOf(item.id)).toBe("2027-01-06");
  });

  it("refuses on the bill day itself and allows it the next day", async () => {
    const item = await addItem({ nextDueDate: "2027-01-06" });
    h.today = "2026-12-06";
    expect((await pay(item.id)).ok).toBe(false);
    expect(await payments()).toEqual([]);
    h.today = "2026-12-07";
    expect(await pay(item.id)).toEqual({ ok: true });
    expect((await payments()).map((p) => p.dueDate)).toEqual(["2027-01-06"]);
    expect(await dueOf(item.id)).toBe("2027-02-06");
  });

  it("follows a month-end bill day", async () => {
    const item = await addItem({ anchorDay: 31, nextDueDate: "2027-02-28" }); // the 31 Jan bill
    h.today = "2027-01-31";
    expect(await pay(item.id)).toEqual({ ok: false, error: "The 31 Jan bill is processed on 31 Jan and can be paid from 1 Feb." });
    h.today = "2027-02-01";
    expect(await pay(item.id)).toEqual({ ok: true });
    expect(await dueOf(item.id)).toBe("2027-03-31");
  });

  it("still pays a late bill", async () => {
    const item = await addItem({ nextDueDate: "2026-11-06" });
    expect(await pay(item.id)).toEqual({ ok: true });
    expect(await dueOf(item.id)).toBe("2026-12-06");
  });
});

describe("every other item is paid whenever, as before", () => {
  it.each([
    ["a subscription", { kind: "subscription" as const }],
    ["an autopay bill", { autopay: true }],
    ["a yearly bill", { frequency: "yearly" as const }],
    ["a quarterly bill", { frequency: "quarterly" as const }],
    ["a weekly bill", { frequency: "weekly" as const }],
  ])("%s, even with a date a long way off", async (_name, over) => {
    const item = await addItem({ nextDueDate: "2027-01-06", ...over });
    expect(await pay(item.id)).toEqual({ ok: true });
    expect((await payments()).map((p) => p.dueDate)).toEqual(["2027-01-06"]);
  });

  it("a one-off bill is finished once paid", async () => {
    const item = await addItem({ frequency: "one_off", anchorDay: null, nextDueDate: "2027-01-06" });
    expect(await pay(item.id)).toEqual({ ok: true });
    expect(await dueOf(item.id)).toBeNull();
  });
});
