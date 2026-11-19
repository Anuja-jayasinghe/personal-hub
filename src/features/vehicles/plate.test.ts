import { describe, expect, it } from "vitest";
import { plateKey, plateParts, plateSlug, vehiclePath } from "./plate";

describe("plateParts", () => {
  it("splits off a province code, and keeps new plates whole", () => {
    expect(plateParts("wp cbd-9754")).toEqual({ province: "WP", main: "CBD-9754" });
    expect(plateParts("BBY-3979")).toEqual({ province: null, main: "BBY-3979" });
    expect(plateParts("AB 1234")).toEqual({ province: null, main: "AB 1234" });
  });
});

describe("plate keys and addresses", () => {
  it("treats spacing, dashes and case as the same plate", () => {
    expect(plateKey("WP CBD-9754")).toBe(plateKey("wp cbd 9754"));
  });
  it("makes an address from the plate, or falls back to the id", () => {
    expect(plateSlug(" WP  CBD-9754 ")).toBe("wp-cbd-9754");
    expect(vehiclePath({ id: "abc", registrationNumber: "CBD-9754" }, "?tab=renewals")).toBe("/vehicles/cbd-9754?tab=renewals");
    expect(vehiclePath({ id: "abc", registrationNumber: null })).toBe("/vehicles/abc");
    expect(vehiclePath({ id: "abc", registrationNumber: "###" })).toBe("/vehicles/abc");
  });
});
