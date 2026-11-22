import { describe, expect, it } from "vitest";
import { vehicleLook } from "./vehicle-look";

const look = (vehicleType: string | null, make: string | null, model: string | null) => vehicleLook({ vehicleType, make, model });

describe("vehicleLook", () => {
  it("draws car-like types, and a vehicle without a type, as the sedan", () => {
    expect(look("car", "Toyota", "Premio")).toEqual({ family: "car" });
    expect(look("suv", "Mitsubishi", "Montero")).toEqual({ family: "car" });
    expect(look(null, null, null)).toEqual({ family: "car" });
  });

  it("picks the kind of bike from the make and model", () => {
    expect(look("motorbike", "BMW", "S1000RR")).toEqual({ family: "bike", kind: "superbike", paint: "motorsport" });
    expect(look("motorbike", "Yamaha", "YZF R1M")).toEqual({ family: "bike", kind: "superbike", paint: "carbon" });
    expect(look("motorbike", "Honda", "CBR 1000RR Fireblade")).toMatchObject({ kind: "superbike", paint: "graphite" });
    expect(look("motorbike", "Aprilia", "Dorsoduro 1200")).toMatchObject({ kind: "supermoto" });
    expect(look("motorbike", "KTM", "390 Duke")).toMatchObject({ kind: "supermoto" });
  });

  it("keeps BMW's naked S 1000 R apart from the RR superbike", () => {
    expect(look("motorbike", "BMW", "S 1000 R")).toMatchObject({ kind: "supermoto" });
  });

  it("falls back to the commuter for any other motorbike, or one with no make or model", () => {
    expect(look("motorbike", "Bajaj", "Discover 125M")).toMatchObject({ kind: "commuter" });
    expect(look("motorbike", null, null)).toMatchObject({ kind: "commuter" });
  });

  it("does not take a model number inside a longer word for a superbike", () => {
    expect(look("motorbike", "BMW", "R1250GS")).toMatchObject({ kind: "commuter" });
  });

  it("draws scooters as the scooter, even one saved as a motorbike", () => {
    expect(look("scooter", "Suzuki", "Burgman")).toEqual({ family: "scooter", paint: "graphite" });
    expect(look("motorbike", "Honda", "Dio 110")).toEqual({ family: "scooter", paint: "graphite" });
  });

  it("keeps the icon for types without a drawing", () => {
    expect(look("bus", "Ashok Leyland", null)).toEqual({ family: "icon" });
    expect(look("three-wheeler", "Bajaj", "RE")).toEqual({ family: "icon" });
  });
});
