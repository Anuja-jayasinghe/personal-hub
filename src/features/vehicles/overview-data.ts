import "server-only";
import { cache } from "react";
import { listOdometerReadings, listRenewals, listServices } from "./queries";
import { pointKey, toPoints, unfitKeys } from "./odometer";
import { carriesOdometer } from "./renewal-validate";

/**
 * Everything the Overview and its detail sheets read about one vehicle (V.2, C149), loaded once per request:
 * its renewals, services and typed readings, and the odometer history that fits (a value that doesn't fit is
 * left out, as everywhere else). Reads go through the query modules, so the demo's visitors only ever see the
 * demo's data. Use inside <Suspense>.
 */
export const loadOverviewData = cache(async (vehicleId: string, ignoreEmissionOdometer: boolean) => {
  const [renewals, services, readings] = await Promise.all([listRenewals(vehicleId), listServices(vehicleId), listOdometerReadings(vehicleId)]);
  const points = toPoints(readings, services, ignoreEmissionOdometer ? [] : renewals.filter((r) => carriesOdometer(r.type)));
  const unfit = unfitKeys(points);
  const fitting = points.filter((p) => !unfit.has(pointKey(p)));
  return { renewals, services, readings, fitting };
});
