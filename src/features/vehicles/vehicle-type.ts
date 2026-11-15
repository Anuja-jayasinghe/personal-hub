/**
 * Vehicle types (car, SUV, motorbike...). The list lives in `appConfig.vehicles.types`; a vehicle
 * stores only the type's key. Pure, so it is testable.
 */
export type VehicleTypeOption = { key: string; label: string; icon: string };

/** The configured type for a stored key, or undefined for no type or a key that is no longer listed. */
export function findVehicleType(types: readonly VehicleTypeOption[], key: string | null | undefined): VehicleTypeOption | undefined {
  return key ? types.find((t) => t.key === key) : undefined;
}
