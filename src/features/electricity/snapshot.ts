import type { ElectricityBill, ElectricityMeter, ElectricityReading } from "@/db/schema";
import { lastChecked, type LastChecked } from "./last-checked";
import { computeLimits, type LimitsResult } from "./limits";
import { limitInputFromUsage, limitRulesFromConfig } from "./limits-input";
import { unitsOf, type HubRules } from "@/features/settings/rules";
import { currentLive, type LiveMeter, type LiveSwitch } from "./live";
import type { LimitUnits } from "./limits-text";
import { describeMeter, type MeterData } from "./meter-data";

export type ElectricitySnapshot = {
  meters: ElectricityMeter[];
  data: Map<string, MeterData>;
  limits: LimitsResult;
  checks: Map<string, LastChecked>;
  units: LimitUnits;
  /** The meter carrying the house (issue #69); null when not set. */
  live: LiveMeter | null;
};

/**
 * Everything Home needs about the active meters, worked out from their rows the same way as the
 * Electricity page: each meter's data, the 120 / 180 rule across them, and when each was last read.
 * Pure: the rules come in from Settings (C107).
 */
export function electricitySnapshot(input: {
  meters: ElectricityMeter[];
  readings: ElectricityReading[];
  bills: ElectricityBill[];
  switches?: readonly LiveSwitch[];
  /** The rules in force (Settings, C107). */
  rules: HubRules;
  today: string;
}): ElectricitySnapshot {
  const { meters, readings, bills, today, switches = [], rules } = input;
  const data = new Map(
    meters.map((m) => [
      m.id,
      describeMeter({
        bills: bills.filter((b) => b.meterId === m.id),
        readings: readings.filter((r) => r.meterId === m.id),
        today,
        cycleDays: rules.billingCycleDays,
      }),
    ]),
  );
  const limits = computeLimits(
    meters.map((m) => limitInputFromUsage(m.id, data.get(m.id)!.usage)),
    limitRulesFromConfig(rules),
  );
  const checks = new Map(meters.map((m) => [m.id, lastChecked(data.get(m.id)!.readingRows[0]?.date ?? null, today, rules.checkEveryDays)]));
  const units = unitsOf(rules);
  const live = currentLive(switches, meters.map((m) => m.id));
  return { meters, data, limits, checks, units, live };
}
