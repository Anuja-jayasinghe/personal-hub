import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/read";
import { cheques } from "@/db/schema";
import { makeTestDb } from "@/test/pglite";

/**
 * The cheque actions (issue #178, C158) on a real in-memory database: only the owner may call any of them,
 * the status moves follow the rules, a deposit records its day, and deleting a cheque cleans up its photos.
 * The access check and the clock are fakes; everything is made up (public repo).
 */
const h = vi.hoisted(() => ({
  db: null as unknown as Db,
  today: "2026-11-24",
  owner: true,
  needs: [] as unknown[],
  cleaned: [] as [string, string][],
  logged: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: () => {} }));
vi.mock("@/db", () => ({
  get db() {
    return h.db;
  },
}));
vi.mock("@/lib/auth", async () => {
  const { ValidationError } = await import("@/features/shared/validation");
  return {
    requireUser: async (need: unknown) => {
      h.needs.push(need);
      if (!h.owner) throw new ValidationError("You do not have access to do that. Ask the owner if you need it.");
      return {};
    },
  };
});
vi.mock("@/features/shared/cleanup", () => ({
  deleteSharedDataOf: async (type: string, id: string) => void h.cleaned.push([type, id]),
}));
vi.mock("@/lib/format", async (original) => ({ ...(await original<typeof import("@/lib/format")>()), todayInAppTz: () => h.today }));

const { createCheque, updateCheque, setChequeStatus, deleteCheque } = await import("./actions");

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};
const made = { fromParty: "Made-Up Traders", amount: "25000.50", chequeDate: "2026-12-10", bank: "Test Bank", chequeNumber: "000111", note: "a note" };
const rows = () => h.db.select().from(cheques);
const byId = async (id: string) => (await h.db.select().from(cheques).where(eq(cheques.id, id)))[0];
async function add(over: Partial<typeof cheques.$inferInsert> = {}) {
  const [row] = await h.db.insert(cheques).values({ fromParty: "Made-Up Traders", amount: "100.00", chequeDate: "2026-12-10", ...over }).returning();
  return row;
}
const move = (id: string, status: string, depositedOn?: string) => setChequeStatus({ ok: false }, form({ id, status, ...(depositedOn ? { depositedOn } : {}) }));

beforeEach(async () => {
  ({ db: h.db } = await makeTestDb());
  h.today = "2026-11-24";
  h.owner = true;
  h.needs = [];
  h.cleaned = [];
  h.logged = [];
}, 60_000);

describe("every cheque action is for the owner alone", () => {
  it("asks for the owner (never a section) and refuses anyone else, changing nothing", async () => {
    const row = await add();
    h.owner = false;
    expect(await createCheque({ ok: false }, form(made))).toMatchObject({ ok: false, error: expect.stringContaining("do not have access") });
    expect(await updateCheque({ ok: false }, form({ ...made, id: row.id, fromParty: "Someone Else" }))).toMatchObject({ ok: false });
    expect(await move(row.id, "cancelled")).toMatchObject({ ok: false });
    await expect(deleteCheque(form({ id: row.id }))).rejects.toThrow("do not have access");
    expect(h.needs).toEqual(["owner", "owner", "owner", "owner"]);
    expect(h.cleaned).toEqual([]);
    const all = await rows();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ fromParty: "Made-Up Traders", status: "waiting" });
  });
});

describe("createCheque and updateCheque", () => {
  it("saves a valid cheque as waiting", async () => {
    expect(await createCheque({ ok: false }, form(made))).toEqual({ ok: true });
    expect(await rows()).toMatchObject([{ fromParty: "Made-Up Traders", amount: "25000.50", chequeDate: "2026-12-10", bank: "Test Bank", chequeNumber: "000111", status: "waiting", depositedOn: null }]);
  });

  it("validates every input and saves nothing when one is wrong", async () => {
    for (const bad of [{ amount: "0" }, { amount: "x" }, { fromParty: "" }, { chequeDate: "2062-01-01" }, { chequeDate: "nonsense" }, { note: "4111 1111 1111 1111" }]) {
      const r = await createCheque({ ok: false }, form({ ...made, ...bad }));
      expect(r.ok).toBe(false);
    }
    expect(await rows()).toEqual([]);
  });

  it("edits the fields but never the status or the deposit date", async () => {
    const row = await add({ status: "deposited", depositedOn: "2026-11-20" });
    expect(await updateCheque({ ok: false }, form({ ...made, id: row.id, status: "cleared", depositedOn: "2020-01-01", fromParty: "Renamed" }))).toEqual({ ok: true });
    expect(await byId(row.id)).toMatchObject({ fromParty: "Renamed", status: "deposited", depositedOn: "2026-11-20" });
  });

  it("lets an old cheque be edited without questioning its unchanged date", async () => {
    const row = await add({ chequeDate: "2025-01-10", status: "cleared", depositedOn: "2025-01-12" });
    expect(await updateCheque({ ok: false }, form({ ...made, id: row.id, chequeDate: "2025-01-10", note: "fixed" }))).toEqual({ ok: true });
    expect((await byId(row.id)).note).toBe("fixed");
  });

  it("refuses a cheque that is not there", async () => {
    expect(await updateCheque({ ok: false }, form({ ...made, id: "99999999-9999-4999-8999-999999999999" }))).toEqual({ ok: false, error: "That cheque could not be found." });
    expect(await updateCheque({ ok: false }, form({ ...made, id: "not-an-id" }))).toEqual({ ok: false, error: "That item could not be found." });
  });
});

describe("setChequeStatus", () => {
  it("waiting to deposited records the day, today when none is given", async () => {
    const a = await add();
    const b = await add();
    expect(await move(a.id, "deposited")).toEqual({ ok: true });
    expect(await move(b.id, "deposited", "2026-11-20")).toEqual({ ok: true });
    expect(await byId(a.id)).toMatchObject({ status: "deposited", depositedOn: "2026-11-24" });
    expect(await byId(b.id)).toMatchObject({ status: "deposited", depositedOn: "2026-11-20" });
  });

  it("refuses a deposit date in the future", async () => {
    const a = await add();
    expect(await move(a.id, "deposited", "2026-11-25")).toEqual({ ok: false, error: "The deposit date cannot be in the future." });
    expect((await byId(a.id)).status).toBe("waiting");
  });

  it("deposited to cleared keeps the deposit date; bounced and cancelled work from waiting and deposited", async () => {
    const a = await add();
    await move(a.id, "deposited", "2026-11-20");
    expect(await move(a.id, "cleared")).toEqual({ ok: true });
    expect(await byId(a.id)).toMatchObject({ status: "cleared", depositedOn: "2026-11-20" });
    const w = await add();
    expect(await move(w.id, "bounced")).toEqual({ ok: true });
    expect((await byId(w.id)).status).toBe("bounced");
    const d = await add();
    await move(d.id, "deposited");
    expect(await move(d.id, "cancelled")).toEqual({ ok: true });
    expect(await byId(d.id)).toMatchObject({ status: "cancelled", depositedOn: "2026-11-24" });
  });

  it("refuses a move the rules do not allow, and changes nothing", async () => {
    const a = await add();
    expect((await move(a.id, "cleared")).ok).toBe(false); // waiting cannot clear
    expect((await move(a.id, "waiting")).ok).toBe(false); // nor move to itself
    expect((await move(a.id, "paid")).ok).toBe(false);
    expect(await byId(a.id)).toMatchObject({ status: "waiting", depositedOn: null });
    const done = await add({ status: "cleared", depositedOn: "2026-11-01" });
    expect((await move(done.id, "bounced")).ok).toBe(false);
    expect((await move(done.id, "deposited")).ok).toBe(false);
  });

  it("puts a finished or deposited cheque back to waiting and forgets the deposit date (a corrected mistake)", async () => {
    const a = await add({ status: "cleared", depositedOn: "2026-11-01" });
    expect(await move(a.id, "waiting")).toEqual({ ok: true });
    expect(await byId(a.id)).toMatchObject({ status: "waiting", depositedOn: null });
    const b = await add({ status: "cancelled" });
    expect(await move(b.id, "waiting")).toEqual({ ok: true });
    const c = await add({ status: "deposited", depositedOn: "2026-11-02" });
    expect(await move(c.id, "waiting")).toEqual({ ok: true });
    expect(await byId(c.id)).toMatchObject({ status: "waiting", depositedOn: null });
  });

  it("two taps at once cannot both win: the second finds the status already changed", async () => {
    const a = await add();
    const results = await Promise.all([move(a.id, "deposited"), move(a.id, "cancelled")]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await rows()).length).toBe(1);
  });

  it("refuses a cheque that is not there", async () => {
    expect(await move("99999999-9999-4999-8999-999999999999", "deposited")).toEqual({ ok: false, error: "That cheque could not be found." });
  });
});

describe("deleteCheque", () => {
  it("removes the cheque after cleaning up its photos (and tasks and notes) in storage", async () => {
    const a = await add();
    const b = await add();
    await deleteCheque(form({ id: a.id }));
    expect(h.cleaned).toEqual([["cheque", a.id]]);
    expect((await rows()).map((r) => r.id)).toEqual([b.id]);
  });

  it("refuses a bad id before touching anything", async () => {
    await expect(deleteCheque(form({ id: "nope" }))).rejects.toThrow("could not be found");
    expect(h.cleaned).toEqual([]);
  });
});

describe("what the actions log", () => {
  it("never logs a cheque's name, amount or number when something unexpected fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => void h.logged.push(args.map(String).join(" ")));
    h.db = { select: () => { throw Object.assign(new Error('insert into "cheques" values (Made-Up Traders, 25000.50, 000111)'), { code: "08006" }); } } as unknown as Db;
    const r = await updateCheque({ ok: false }, form({ ...made, id: "11111111-1111-4111-8111-111111111111" }));
    spy.mockRestore();
    expect(r).toEqual({ ok: false, error: "Something went wrong. Please try again." });
    expect(h.logged.join("\n")).toMatch(/Cheque action failed: Error \(08006\)/);
    expect(h.logged.join("\n")).not.toMatch(/Made-Up|25000|000111/);
  });
});
