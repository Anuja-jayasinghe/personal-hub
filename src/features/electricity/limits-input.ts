import { appConfig } from "@/config/app.config";
import type { LimitRules, MeterInput } from "./limits";
import type { SinceLastBill } from "./since-bill";

/** The numbers 120 / 180 / "near" from app.config.ts, in hundredths of a kWh, ready for `computeLimits`. */
export function limitRulesFromConfig(config: { lowUnits: number; highUnits: number; nearUnits: number } = appConfig.electricity.limits): LimitRules {
  return { low: config.lowUnits * 100, high: config.highUnits * 100, near: config.nearUnits * 100 };
}

/** One meter's usage since its last bill as the engine's input: unknown (null) until there is a bill and a reading after it. */
export function limitInputFromUsage(id: string, usage: SinceLastBill): MeterInput {
  if (usage.state !== "ok") return { id, used: null, dailyAverage: null, projected: null };
  return { id, used: usage.units, dailyAverage: usage.dailyAverage, projected: usage.projected };
}
