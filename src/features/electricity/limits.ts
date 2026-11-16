/**
 * The limits engine for the two-slab rule (DECISIONS C82). Pure: no database, no clock, no config
 * import, so it is easy to test; the page feeds it the numbers from app.config.ts and from each
 * meter's usage since its last bill. All amounts are hundredths of a kWh, like the rest of the
 * electricity code.
 *
 * The rule: in a billing cycle, one meter stays at `low` or below and the other may run up to `high`.
 * Which is which is decided by the readings: the first meter to cross `low` becomes the "high"
 * meter and every other meter must then be held at `low` or below.
 */

export type LimitRules = { low: number; high: number; near: number };

export type MeterInput = {
  id: string;
  /** Used since the last bill; null when it cannot be known yet (no bill, or no reading since it). */
  used: number | null;
  /** Used per day since the last bill, if known. */
  dailyAverage: number | null;
  /** What a full billing cycle would reach at that pace, if known. */
  projected: number | null;
};

/** "open": nobody has crossed `low` yet, so this meter could still become the high one. */
export type MeterRole = "open" | "low" | "high";
export type MeterState = "ok" | "near" | "over";

export type MeterLimit = {
  id: string;
  role: MeterRole;
  used: number;
  /** False when `used` was unknown and counted as zero. */
  known: boolean;
  /** The limit this meter works to right now (`high` for the high meter, `low` otherwise). */
  limit: number;
  /** Units left to that limit; negative once it is passed. */
  left: number;
  state: MeterState;
};

export type LimitAdvice =
  | { kind: "near"; meterId: string; /** The other meter and how much it has left, when there is exactly one other. */ otherId: string | null; otherLeft: number | null }
  | { kind: "over"; meterId: string };

export type LimitsResult = {
  meters: MeterLimit[];
  totalUsed: number;
  /** Units that can still be used across the meters without another price jump. Never negative. */
  headroom: number;
  /** Null when no meter has a pace yet. */
  pace: {
    /** Units a day across the meters. */
    daily: number;
    /** What the cycle would total at that pace. */
    projectedTotal: number;
    /** True when the rest of the cycle, at this pace, stays within the headroom. */
    fits: boolean;
    /** Days until the headroom is used up at this pace; null when nothing is being used. */
    daysUntilOut: number | null;
  } | null;
  advice: LimitAdvice | null;
};

export function computeLimits(meters: readonly MeterInput[], rules: LimitRules): LimitsResult {
  const rows = meters.map((m) => ({ id: m.id, used: Math.max(0, m.used ?? 0), known: m.used !== null }));

  // Who has crossed `low`? The most-used one of those is the high meter; any other is a breach.
  const crossed = rows.filter((r) => r.used > rules.low).sort((a, b) => b.used - a.used);
  const highId = crossed[0]?.id ?? null;

  const limits: MeterLimit[] = rows.map((r) => {
    const role: MeterRole = r.id === highId ? "high" : highId === null ? "open" : "low";
    const limit = role === "high" ? rules.high : rules.low;
    const left = limit - r.used;
    const state: MeterState = left < 0 ? "over" : left <= rules.near ? "near" : "ok";
    return { id: r.id, role, used: r.used, known: r.known, limit, left, state };
  });

  const totalUsed = limits.reduce((s, m) => s + m.used, 0);
  // With nobody over `low` yet, one meter can still be granted the extra room up to `high`.
  const extra = highId === null && limits.length > 0 ? rules.high - rules.low : 0;
  const headroom = limits.reduce((s, m) => s + Math.max(0, m.left), 0) + extra;

  const withPace = meters.filter((m) => m.dailyAverage !== null || m.projected !== null);
  let pace: LimitsResult["pace"] = null;
  if (withPace.length > 0) {
    const daily = meters.reduce((s, m) => s + (m.dailyAverage ?? 0), 0);
    const projectedTotal = meters.reduce((s, m) => s + (m.projected ?? Math.max(0, m.used ?? 0)), 0);
    pace = {
      daily,
      projectedTotal,
      fits: projectedTotal - totalUsed <= headroom,
      daysUntilOut: daily > 0 ? headroom / daily : null,
    };
  }

  return { meters: limits, totalUsed, headroom, pace, advice: adviceFor(limits) };
}

function adviceFor(limits: readonly MeterLimit[]): LimitAdvice | null {
  const over = limits.find((m) => m.state === "over");
  if (over) return { kind: "over", meterId: over.id };
  const near = limits.find((m) => m.state === "near");
  if (!near) return null;
  const others = limits.filter((m) => m.id !== near.id);
  const other = others.length === 1 ? others[0] : null;
  return { kind: "near", meterId: near.id, otherId: other?.id ?? null, otherLeft: other ? other.left : null };
}
