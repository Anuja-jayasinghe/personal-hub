import { describe, expect, it } from "vitest";
import { findVehicleType } from "./vehicle-type";

const TYPES = [
  { key: "car", label: "Car", icon: "car" },
  { key: "motorbike", label: "Motorbike", icon: "motorbike" },
];

describe("findVehicleType", () => {
  it("finds a type by its key", () => {
    expect(findVehicleType(TYPES, "motorbike")).toEqual({ key: "motorbike", label: "Motorbike", icon: "motorbike" });
  });
  it("is undefined for no type, an empty key, or a key that is not listed", () => {
    expect(findVehicleType(TYPES, null)).toBeUndefined();
    expect(findVehicleType(TYPES, undefined)).toBeUndefined();
    expect(findVehicleType(TYPES, "")).toBeUndefined();
    expect(findVehicleType(TYPES, "spaceship")).toBeUndefined();
    expect(findVehicleType(TYPES, "Motorbike")).toBeUndefined(); // the label is not the key
  });
});
