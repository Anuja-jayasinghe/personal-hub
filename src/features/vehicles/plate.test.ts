import { describe, expect, it } from "vitest";
import { plateKey, plateLayout, plateParts, plateSlug, vehiclePath } from "./plate";

describe("plateParts", () => {
  it("splits off a province code, and keeps new plates whole", () => {
    expect(plateParts("wp cab-1234")).toEqual({ province: "WP", main: "CAB-1234" });
    expect(plateParts("BAA-5678")).toEqual({ province: null, main: "BAA-5678" });
    expect(plateParts("AB 1234")).toEqual({ province: null, main: "AB 1234" });
  });
});

describe("plateLayout", () => {
  it("splits a plate into province, series and digits", () => {
    expect(plateLayout("wp cab-1234")).toEqual({ province: "WP", series: "CAB", digits: "1234" });
    expect(plateLayout("KX 4512")).toEqual({ province: null, series: "KX", digits: "4512" });
    expect(plateLayout("65-1234")).toEqual({ province: null, series: "65", digits: "1234" });
  });
  it("keeps anything else whole", () => {
    expect(plateLayout("SP TRACTOR 7")).toEqual({ province: "SP", series: "TRACTOR 7", digits: null });
  });
});

describe("plate keys and addresses", () => {
  it("treats spacing, dashes and case as the same plate", () => {
    expect(plateKey("WP CAB-1234")).toBe(plateKey("wp cab 1234"));
  });
  it("makes an address from the plate, or falls back to the id", () => {
    expect(plateSlug(" WP  CAB-1234 ")).toBe("wp-cab-1234");
    expect(vehiclePath({ id: "abc", registrationNumber: "CAB-1234" }, "?tab=renewals")).toBe("/vehicles/cab-1234?tab=renewals");
    expect(vehiclePath({ id: "abc", registrationNumber: null })).toBe("/vehicles/abc");
    expect(vehiclePath({ id: "abc", registrationNumber: "###" })).toBe("/vehicles/abc");
  });
});
