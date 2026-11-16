import type { MeterLimit } from "@/features/electricity/limits";
import { roleChip, type LimitUnits } from "@/features/electricity/limits-text";

const base = "inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium";

/** The meter's job right now (under 120, allowed to 180, hold under 120) and, when it matters, how close it is. */
export function LimitChips({ limit, units }: { limit: MeterLimit; units: LimitUnits }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className={`${base} bg-muted text-foreground`}>{roleChip(limit.role, units)}</span>
      {limit.state === "near" ? (
        <span className={`${base} bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100`}>Close to the limit</span>
      ) : null}
      {limit.state === "over" ? (
        <span className={`${base} bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-100`}>Over the limit</span>
      ) : null}
    </span>
  );
}
