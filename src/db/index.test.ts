import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { maxConnections, usesTransactionPooler } = await import("./index");

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

describe("the transaction pooler (issue #278)", () => {
  it("is recognised by the port of the connection string, and nothing else counts", () => {
    expect(usesTransactionPooler("postgresql://u:p@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres")).toBe(true);
    expect(usesTransactionPooler("postgresql://u:p@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres")).toBe(false);
    expect(usesTransactionPooler("postgresql://u:p@host/postgres")).toBe(false);
    expect(usesTransactionPooler("not a url")).toBe(false);
    expect(usesTransactionPooler("")).toBe(false);
    expect(usesTransactionPooler(undefined)).toBe(false);
  });

  it("gets 4 connections by default, whatever the environment, and DATABASE_MAX_CONNECTIONS still wins", () => {
    expect(maxConnections({ VERCEL: "1" }, true)).toBe(4);
    expect(maxConnections({}, true)).toBe(4);
    expect(maxConnections({ VERCEL: "1", DATABASE_MAX_CONNECTIONS: "8" }, true)).toBe(8);
    expect(maxConnections({ VERCEL: "1", DATABASE_MAX_CONNECTIONS: "99" }, true)).toBe(4);
  });

  it("leaves the session pooler's sizes alone", () => {
    expect(maxConnections({ VERCEL: "1" }, false)).toBe(1);
    expect(maxConnections({}, false)).toBe(5);
  });
});
