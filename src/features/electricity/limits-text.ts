import type { LimitAdvice, LimitsResult, MeterLimit, MeterRole } from "./limits";

/**
 * The words for the limits on screen (2b.3). Pure: figures in, sentences out, so the wording is
 * easy to test and to change in one place. Amounts arrive in hundredths of a kWh and are shown as
 * whole units; "left" is rounded down, so the number shown is never more than what is really left.
 */

/** The limits in whole units, for the wording (the same numbers as `electricity.limits` in app.config.ts). */
export type LimitUnits = { low: number; high: number };

const units = (n: number) => `${n} unit${n === 1 ? "" : "s"}`;
const whole = (hundredths: number) => Math.round(hundredths / 100);

/** Whole units left, rounded down; negative once the limit is passed (rounded so the overrun is never understated). */
export function unitsLeft(m: Pick<MeterLimit, "left">): number {
  return m.left >= 0 ? Math.floor(m.left / 100) : -Math.ceil(-m.left / 100);
}

/** The short chip that says which job a meter has right now. */
export function roleChip(role: MeterRole, u: LimitUnits): string {
  if (role === "high") return `Allowed to ${u.high}`;
  if (role === "low") return `Hold under ${u.low}`;
  return `Under ${u.low}`;
}

/** "24 of 120 used" for a meter against its current limit. */
export function usedOfLimit(m: Pick<MeterLimit, "used" | "limit">): string {
  return `${whole(m.used)} of ${whole(m.limit)} used`;
}

/** The headline for a meter: "96 left", or "5 over" once the limit is passed. */
export function leftHeadline(m: Pick<MeterLimit, "left">): { value: number; label: "left" | "over" } {
  const left = unitsLeft(m);
  return left >= 0 ? { value: left, label: "left" } : { value: -left, label: "over" };
}

/** One sentence on whether this cycle, at the current pace, stays inside the room, or null while no pace is known. */
export function paceLine(result: Pick<LimitsResult, "pace" | "totalUsed" | "headroom">): { tone: "ok" | "warn"; text: string } | null {
  const { pace } = result;
  if (!pace) return null;
  const budget = whole(result.totalUsed + result.headroom);
  const projected = whole(pace.projectedTotal);
  if (pace.fits) {
    return { tone: "ok", text: `On pace for about ${projected} units this cycle. That fits in the ${budget} you have.` };
  }
  const days = pace.daysUntilOut === null ? "" : ` The room runs out in about ${Math.floor(pace.daysUntilOut)} day${Math.floor(pace.daysUntilOut) === 1 ? "" : "s"}.`;
  return { tone: "warn", text: `On pace for about ${projected} units this cycle, more than the ${budget} you have before a price jump.${days}` };
}

/** The message for a meter close to, or over, its limit; null when there is nothing to say. */
export function adviceLine(
  advice: LimitAdvice | null,
  result: Pick<LimitsResult, "meters">,
  nameOf: (meterId: string) => string,
  u: LimitUnits,
): string | null {
  if (!advice) return null;
  const meter = result.meters.find((m) => m.id === advice.meterId);
  if (!meter) return null;
  const name = nameOf(meter.id);
  const limit = whole(meter.limit);

  if (advice.kind === "over") {
    const base = `${name} is over its limit: ${whole(meter.used)} of ${limit}.`;
    return meter.role === "low" ? `${base} Only one meter should pass ${u.low}.` : base;
  }

  const left = unitsLeft(meter);
  const base = `${name} is ${left <= 0 ? "at" : `${units(left)} from`} ${limit}.`;
  if (advice.otherId === null || advice.otherLeft === null) return base;
  const other = nameOf(advice.otherId);
  const otherLeft = Math.floor(Math.max(0, advice.otherLeft) / 100);
  if (meter.role === "high") return `${base} ${other} has ${otherLeft} left.`;
  return `${base} ${other} has ${otherLeft} left. Switch to ${other}, or let ${name} pass ${u.low} and keep ${other} under ${u.low}.`;
}
