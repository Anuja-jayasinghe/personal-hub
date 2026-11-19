import { slabScale } from "@/features/electricity/cycle";
import type { MeterState } from "@/features/electricity/limits";

const fill = { ok: "bg-primary", near: "bg-status-soon-mark", over: "bg-status-overdue" } as const;
const dash = { ok: "border-primary", near: "border-status-soon-mark", over: "border-status-overdue" } as const;
const whole = (h: number) => Math.round(h / 100);

/**
 * The slab rule (DESIGN.md, The slab rule): one meter on a line from 0 to just past the high slab.
 * The used part is a thick line ending in a node, the pace is a dashed line to where the cycle ends,
 * and 120 and 180 are ringed nodes (amber and red). All figures are hundredths of a kWh.
 * Built from positioned elements, not an SVG, so the nodes stay round at any width.
 */
export function SlabRule({
  used,
  projected,
  low,
  high,
  state,
  size = "md",
}: {
  used: number;
  projected: number | null;
  low: number;
  high: number;
  state: MeterState;
  size?: "sm" | "md";
}) {
  const s = slabScale({ used, projected, low, high });
  const label = `${whole(used)} units used, ${low / 100} and ${high / 100} marked${
    s.projectedPct !== null && projected !== null ? `, on pace for about ${whole(projected)} by the end of the cycle` : ""
  }.`;
  const node = size === "md" ? "size-3" : "size-2.5";
  const ring = size === "md" ? "size-3.5" : "size-3";
  const at = (pct: number) => ({ left: `${pct}%` });

  return (
    <div role="img" aria-label={label} className={`relative mx-1.5 ${size === "md" ? "h-12" : "h-11"}`}>
      {/* track */}
      <span aria-hidden className="absolute inset-x-0 top-[18px] h-0.5 -translate-y-1/2 rounded-full bg-border" />
      {/* pace */}
      {s.projectedPct !== null ? (
        <span
          aria-hidden
          className={`absolute top-[18px] -translate-y-1/2 border-t-2 border-dashed ${dash[state]} motion-safe:animate-pulse`}
          style={{ left: `${s.usedPct}%`, width: `${s.projectedPct - s.usedPct}%` }}
        />
      ) : null}
      {/* used */}
      <span aria-hidden className={`absolute top-[18px] left-0 h-1 -translate-y-1/2 rounded-full ${fill[state]}`} style={{ width: `${s.usedPct}%` }} />
      {/* start, 120, 180, pace end */}
      <span aria-hidden className={`absolute top-[18px] ${node} -translate-1/2 rounded-full ${fill[state]}`} style={at(0)} />
      <span aria-hidden className={`absolute top-[18px] ${ring} -translate-1/2 rounded-full border-2 border-status-soon-mark bg-card`} style={at(s.lowPct)} />
      <span aria-hidden className={`absolute top-[18px] ${ring} -translate-1/2 rounded-full border-2 border-status-overdue bg-card`} style={at(s.highPct)} />
      {s.projectedPct !== null ? (
        <span aria-hidden className={`absolute top-[18px] size-2.5 -translate-1/2 rounded-full border-2 ${dash[state]} bg-card`} style={at(s.projectedPct)} />
      ) : null}
      {/* the meter now */}
      <span aria-hidden className={`absolute top-[18px] ${ring} -translate-1/2 rounded-full ${fill[state]} ring-[3px] ring-card`} style={at(s.usedPct)} />
      {/* labels */}
      <span aria-hidden className="absolute bottom-0 font-mono text-[10px] text-label" style={at(0)}>
        0
      </span>
      <span aria-hidden className="absolute bottom-0 -translate-x-1/2 font-mono text-[10px] font-medium text-foreground" style={at(s.lowPct)}>
        {low / 100}
      </span>
      <span aria-hidden className="absolute bottom-0 -translate-x-1/2 font-mono text-[10px] font-medium text-foreground" style={at(s.highPct)}>
        {high / 100}
      </span>
      {s.projectedPct !== null && projected !== null ? (
        <span
          aria-hidden
          className={`absolute top-0 font-mono text-[10px] ${s.projectedPct > 92 ? "" : "-translate-x-1/2"} ${state === "ok" ? "text-primary" : state === "near" ? "text-status-soon" : "text-status-overdue"}`}
          style={s.projectedPct > 92 ? { right: 0 } : at(s.projectedPct)}
        >
          ~{whole(projected)}
          {s.projectedBeyond ? "→" : ""}
        </span>
      ) : null}
    </div>
  );
}
