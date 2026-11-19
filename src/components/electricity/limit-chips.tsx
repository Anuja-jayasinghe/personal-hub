import type { MeterLimit } from "@/features/electricity/limits";
import { roleChip, type LimitUnits } from "@/features/electricity/limits-text";

const base = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium";

/** The lamp colour for a meter's state against its limit: green on track, amber near, red over (C92). */
export const stateLamp = { ok: "bg-status-ok", near: "bg-status-soon-mark", over: "bg-status-overdue" } as const;

/** The meter's job right now (under 120, allowed to 180, hold under 120) and, when it matters, how close it is. */
export function LimitChips({ limit, units }: { limit: MeterLimit; units: LimitUnits }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className={`${base} bg-raised text-foreground ring-1 ring-border`}>
        <span aria-hidden className={`size-1.5 rounded-full ${stateLamp[limit.state]}`} />
        {roleChip(limit.role, units)}
      </span>
      {limit.state === "near" ? <span className={`${base} bg-status-soon-soft text-status-soon`}>Close to the limit</span> : null}
      {limit.state === "over" ? <span className={`${base} bg-status-overdue-soft text-status-overdue`}>Over the limit</span> : null}
    </span>
  );
}
