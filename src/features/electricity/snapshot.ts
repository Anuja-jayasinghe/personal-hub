import { appConfig } from "@/config/app.config";
import type { ElectricityBill, ElectricityMeter, ElectricityReading } from "@/db/schema";
import { lastChecked, type LastChecked } from "./last-checked";
import { computeLimits, type LimitsResult } from "./limits";
import { limitInputFromUsage, limitRulesFromConfig } from "./limits-input";
import type { LimitUnits } from "./limits-text";
import { describeMeter, type MeterData } from "./meter-data";

export type ElectricitySnapshot = {
  meters: ElectricityMeter[];
  data: Map<string, MeterData>;
  limits: LimitsResult;
  checks: Map<string, LastChecked>;
  units: LimitUnits;
};

/**
 * Everything Home needs about the active meters, worked out from their rows the same way as the
 * Electricity page: each meter's data, the 120 / 180 rule across them, and when each was last read.
 * Pure apart from reading the numbers in app.config.ts.
 */
export function electricitySnapshot(input: {
  meters: ElectricityMeter[];
  readings: ElectricityReading[];
  bills: ElectricityBill[];
  today: string;
}): ElectricitySnapshot {
  const { meters, readings, bills, today } = input;
  const data = new Map(
    meters.map((m) => [
      m.id,
      describeMeter({
        bills: bills.filter((b) => b.meterId === m.id),
        readings: readings.filter((r) => r.meterId === m.id),
        today,
        cycleDays: appConfig.electricity.billingCycleDays,
      }),
    ]),
  );
  const limits = computeLimits(
    meters.map((m) => limitInputFromUsage(m.id, data.get(m.id)!.usage)),
    limitRulesFromConfig(),
  );
  const checks = new Map(meters.map((m) => [m.id, lastChecked(data.get(m.id)!.readingRows[0]?.date ?? null, today, appConfig.electricity.checkEveryDays)]));
  const units = { low: appConfig.electricity.limits.lowUnits, high: appConfig.electricity.limits.highUnits };
  return { meters, data, limits, checks, units };
}
