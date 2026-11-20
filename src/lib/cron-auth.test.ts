import { describe, expect, it } from "vitest";
import { isCronRequest } from "./cron-auth";

const secret = "s".repeat(40);

describe("isCronRequest", () => {
  it("accepts the bearer secret", () => {
    expect(isCronRequest(`Bearer ${secret}`, secret)).toBe(true);
  });
  it("refuses a wrong, missing or partial secret", () => {
    expect(isCronRequest(`Bearer ${"x".repeat(40)}`, secret)).toBe(false);
    expect(isCronRequest(null, secret)).toBe(false);
    expect(isCronRequest(secret, secret)).toBe(false);
    expect(isCronRequest(`Bearer ${secret}x`, secret)).toBe(false);
  });
  it("fails closed when no secret, or a short one, is configured", () => {
    expect(isCronRequest("Bearer ", undefined)).toBe(false);
    expect(isCronRequest("Bearer ", "")).toBe(false);
    expect(isCronRequest("Bearer short", "short")).toBe(false);
  });
});
