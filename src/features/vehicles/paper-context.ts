import { appConfig } from "@/config/app.config";
import { allows, type Access } from "@/features/people/access";
import { vehiclePart } from "./doc-names";
import { prefillFrom, type PaperContext } from "./paper-flow";
import type { OilRules } from "./service-logic";

/**
 * Everything the sheet for adding a paper needs to know about one vehicle and the person looking at it, worked out
 * on the server and handed down as plain values (nothing about a person's access is decided in the browser; the
 * actions decide again). Pure: the page passes in what it already loaded.
 */
export function paperContext(args: {
  vehicle: { id: string; nickname: string; registrationNumber: string | null; ignoreEmissionOdometer: boolean };
  access: Access;
  /** Today in the app time zone. */
  today: string;
  oil: OilRules;
  /** The vehicle's renewals, to prefill the provider and the dates from the last one of each kind. */
  renewals: readonly { type: string; provider: string | null; startDate: string | null; expiryDate: string }[];
}): PaperContext {
  const { vehicle, access } = args;
  return {
    vehicleId: vehicle.id,
    vehicleName: vehicle.nickname,
    namePrefix: vehiclePart(vehicle),
    today: args.today,
    serviceTypes: appConfig.vehicles.serviceTypes,
    renewalTypes: appConfig.vehicles.renewalTypes.map((t) => t.label),
    oil: args.oil,
    can: { records: allows(access, "vehicles", "add"), files: allows(access, "vehicle_documents", "add") },
    askOdometer: !vehicle.ignoreEmissionOdometer,
    prefill: prefillFrom(args.renewals),
  };
}
