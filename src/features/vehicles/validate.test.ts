import { describe, expect, it } from "vitest";
import { parseVehicle } from "./validate";

const FUELS = ["Petrol", "Diesel", "Hybrid", "Electric", "Other"];
const ok = (raw: Record<string, string>) => {
  const r = parseVehicle(raw, FUELS);
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`);
  return r.value;
};
const err = (raw: Record<string, string>) => {
  const r = parseVehicle(raw, FUELS);
  if (r.ok) throw new Error("expected an error");
  return r.error;
};

describe("parseVehicle", () => {
  it("accepts a minimal vehicle (only a nickname)", () => {
    expect(ok({ nickname: "Corolla" })).toEqual({
      nickname: "Corolla",
      registrationNumber: null,
      make: null,
      model: null,
      year: null,
      fuelType: null,
      odometerKm: null,
    });
  });

  it("accepts a full vehicle and tidies it", () => {
    expect(
      ok({ nickname: "  Family  car ", registrationNumber: " cab  1234 ", make: "Toyota", model: "Corolla", year: "2018", fuelType: "Petrol", odometerKm: "45,200" }),
    ).toEqual({
      nickname: "Family car",
      registrationNumber: "CAB 1234",
      make: "Toyota",
      model: "Corolla",
      year: 2018,
      fuelType: "Petrol",
      odometerKm: 45200,
    });
  });

  it("requires a nickname", () => {
    expect(err({ nickname: "   " })).toMatch(/Nickname is required/);
    expect(err({})).toMatch(/Nickname is required/);
  });

  it("limits text lengths", () => {
    expect(err({ nickname: "x".repeat(61) })).toMatch(/at most 60/);
    expect(err({ nickname: "A", registrationNumber: "x".repeat(21) })).toMatch(/Registration number must be at most 20/);
  });

  it("checks the year range at the edges", () => {
    expect(ok({ nickname: "A", year: "1886" }).year).toBe(1886);
    expect(ok({ nickname: "A", year: "2100" }).year).toBe(2100);
    expect(err({ nickname: "A", year: "1885" })).toMatch(/Year must be between 1886 and 2100/);
    expect(err({ nickname: "A", year: "2101" })).toMatch(/Year must be between/);
    expect(err({ nickname: "A", year: "20x8" })).toMatch(/Year must be a whole number/);
    expect(err({ nickname: "A", year: "2018.5" })).toMatch(/whole number/);
  });

  it("checks the odometer", () => {
    expect(ok({ nickname: "A", odometerKm: "0" }).odometerKm).toBe(0);
    expect(ok({ nickname: "A", odometerKm: "45 200" }).odometerKm).toBe(45200);
    expect(err({ nickname: "A", odometerKm: "-5" })).toMatch(/Odometer must be a whole number/);
    expect(err({ nickname: "A", odometerKm: "12.5" })).toMatch(/whole number/);
    expect(err({ nickname: "A", odometerKm: "10000000" })).toMatch(/Odometer must be between/);
  });

  it("only allows listed fuel types, or none", () => {
    expect(ok({ nickname: "A", fuelType: "Diesel" }).fuelType).toBe("Diesel");
    expect(ok({ nickname: "A", fuelType: "" }).fuelType).toBeNull();
    expect(err({ nickname: "A", fuelType: "Steam" })).toMatch(/Fuel type/);
  });
});
