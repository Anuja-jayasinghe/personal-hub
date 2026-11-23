import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notifyGate } from "@/features/notifications/gate";

/** The daily run's door (C127, C139): our cron secret only, production only, counts only, never cached. */

const run = vi.fn();
vi.mock("@/features/notifications/run", () => ({ runNotifications: () => run() }));

const SECRET = "s".repeat(40);
const call = (authorization?: string) => new Request("https://hub.example/api/notify", { headers: authorization ? { authorization } : {} });

describe("notifyGate", () => {
  it("refuses a missing or wrong secret, and fails closed without one", () => {
    expect(notifyGate(null, { CRON_SECRET: SECRET, VERCEL_ENV: "production" })).toBe("unauthorized");
    expect(notifyGate(`Bearer ${"x".repeat(40)}`, { CRON_SECRET: SECRET, VERCEL_ENV: "production" })).toBe("unauthorized");
    expect(notifyGate(`Bearer ${SECRET}`, { VERCEL_ENV: "production" })).toBe("unauthorized");
  });
  it("skips anywhere but production", () => {
    expect(notifyGate(`Bearer ${SECRET}`, { CRON_SECRET: SECRET, VERCEL_ENV: "preview" })).toBe("skipped");
    expect(notifyGate(`Bearer ${SECRET}`, { CRON_SECRET: SECRET, VERCEL_ENV: "development" })).toBe("skipped");
    expect(notifyGate(`Bearer ${SECRET}`, { CRON_SECRET: SECRET })).toBe("skipped");
  });
  it("runs with the secret on production", () => {
    expect(notifyGate(`Bearer ${SECRET}`, { CRON_SECRET: SECRET, VERCEL_ENV: "production" })).toBe("run");
  });
});

describe("GET /api/notify", () => {
  beforeEach(() => {
    run.mockReset();
    run.mockResolvedValue({ today: "2026-11-23", notices: { email: 1, push: 0 } });
    vi.stubEnv("CRON_SECRET", SECRET);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("answers 401 to a bad secret, and runs nothing", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const { GET } = await import("./route");
    const res = await GET(call("Bearer wrong"));
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(run).not.toHaveBeenCalled();
  });

  it("skips on a preview, even with the secret", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const { GET } = await import("./route");
    const res = await GET(call(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, skipped: "not production" });
    expect(run).not.toHaveBeenCalled();
  });

  it("runs on production and answers with the counts, never cached", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const { GET } = await import("./route");
    const res = await GET(call(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, today: "2026-11-23", notices: { email: 1, push: 0 } });
    expect(run).toHaveBeenCalledOnce();
  });

  it("says only that it failed when the run throws", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    run.mockRejectedValue(new Error("connection refused at db.secret-host:5432"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { GET } = await import("./route");
    const res = await GET(call(`Bearer ${SECRET}`));
    expect(res.status).toBe(500);
    expect(await res.text()).toBe('{"ok":false}');
  });
});
