import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown while a page's data loads (R.6, board HSystem): three nodes lighting up in turn on a line,
 * "Connecting", and placeholder blocks where the page will be. The shell around it stays.
 */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <svg width={64} height={14} viewBox="0 0 64 14" aria-hidden>
          <line x1={7} y1={7} x2={57} y2={7} stroke="var(--border)" strokeWidth={2} />
          {[7, 32, 57].map((cx, i) => (
            <circle
              key={cx}
              cx={cx}
              cy={7}
              r={5}
              fill="var(--primary)"
              className="animate-[hub-node_1.2s_ease-in-out_infinite]"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </svg>
        <span className="font-mono text-[10.5px] tracking-[0.14em] text-label uppercase">Connecting</span>
      </div>
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-44 rounded-3xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    </div>
  );
}
