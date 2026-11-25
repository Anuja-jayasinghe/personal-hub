import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { maxConnections } = await import("./index");

describe("maxConnections (issue #257)", () => {
  it("keeps today's sizes when the setting is absent: 1 on Vercel, 5 locally", () => {
    expect(maxConnections({ VERCEL: "1" })).toBe(1);
    expect(maxConnections({})).toBe(5);
  });
  it("uses DATABASE_MAX_CONNECTIONS when it is a whole number from 1 to 40", () => {
    expect(maxConnections({ VERCEL: "1", DATABASE_MAX_CONNECTIONS: "12" })).toBe(12);
    expect(maxConnections({ DATABASE_MAX_CONNECTIONS: "1" })).toBe(1);
    expect(maxConnections({ DATABASE_MAX_CONNECTIONS: "40" })).toBe(40);
  });
  it("ignores anything else and falls back", () => {
    for (const bad of ["", "0", "-3", "41", "12.5", "abc", "1e3"]) {
      expect(maxConnections({ VERCEL: "1", DATABASE_MAX_CONNECTIONS: bad })).toBe(1);
      expect(maxConnections({ DATABASE_MAX_CONNECTIONS: bad })).toBe(5);
    }
  });
});
