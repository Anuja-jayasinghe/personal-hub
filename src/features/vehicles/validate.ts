/**
 * Validation for the vehicle form. Pure (plain strings in, plain values out): no database, no
 * config import, no FormData, so the rules are easy to test. The server action feeds it the form
 * fields and the allowed fuel types from app.config.ts.
 */

export type VehicleFields = {
  nickname: string;
  registrationNumber: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  fuelType: string | null;
  vehicleType: string | null;
  odometerKm: number | null;
};

export type VehicleResult = { ok: true; value: VehicleFields } | { ok: false; error: string };

export const YEAR_MIN = 1886; // the first car; matches the database check
export const YEAR_MAX = 2100;
export const ODOMETER_MAX = 9_999_999;

const clean = (v: string | undefined) => (v ?? "").trim().replace(/\s+/g, " ");

function optionalText(raw: string | undefined, label: string, max: number): { value: string | null; error?: string } {
  const v = clean(raw);
  if (!v) return { value: null };
  if (v.length > max) return { value: null, error: `${label} must be at most ${max} characters.` };
  return { value: v };
}

/** Whole non-negative number, allowing thousands separators ("45,200" or "45 200"). Empty = null. */
function optionalInteger(raw: string | undefined, label: string, min: number, max: number): { value: number | null; error?: string } {
  const v = (raw ?? "").trim().replace(/[,\s]/g, "");
  if (!v) return { value: null };
  if (!/^\d+$/.test(v)) return { value: null, error: `${label} must be a whole number.` };
  const n = Number(v);
  if (n < min || n > max) return { value: null, error: `${label} must be between ${min} and ${max}.` };
  return { value: n };
}

export function parseVehicle(
  raw: Record<string, string | undefined>,
  fuelTypes: readonly string[],
  vehicleTypeKeys: readonly string[] = [],
): VehicleResult {
  const nickname = clean(raw.nickname);
  if (!nickname) return { ok: false, error: "Nickname is required." };
  if (nickname.length > 60) return { ok: false, error: "Nickname must be at most 60 characters." };

  const reg = optionalText(raw.registrationNumber, "Registration number", 20);
  if (reg.error) return { ok: false, error: reg.error };
  const make = optionalText(raw.make, "Make", 60);
  if (make.error) return { ok: false, error: make.error };
  const model = optionalText(raw.model, "Model", 60);
  if (model.error) return { ok: false, error: model.error };
  const year = optionalInteger(raw.year, "Year", YEAR_MIN, YEAR_MAX);
  if (year.error) return { ok: false, error: year.error };
  const odometer = optionalInteger(raw.odometerKm, "Odometer", 0, ODOMETER_MAX);
  if (odometer.error) return { ok: false, error: odometer.error };

  const fuel = clean(raw.fuelType);
  if (fuel && !fuelTypes.includes(fuel)) return { ok: false, error: "Fuel type is not one of the listed options." };

  const vehicleType = clean(raw.vehicleType);
  if (vehicleType && !vehicleTypeKeys.includes(vehicleType)) return { ok: false, error: "Vehicle type is not one of the listed options." };

  return {
    ok: true,
    value: {
      nickname,
      // Registration numbers are written in capitals, e.g. "CAB 1234".
      registrationNumber: reg.value ? reg.value.toUpperCase() : null,
      make: make.value,
      model: model.value,
      year: year.value,
      fuelType: fuel || null,
      vehicleType: vehicleType || null,
      odometerKm: odometer.value,
    },
  };
}
