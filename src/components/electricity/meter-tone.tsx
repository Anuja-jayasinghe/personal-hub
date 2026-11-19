import { badgeLetter } from "@/features/electricity/overview";

/**
 * How each meter is told apart (C78, restyled in R.3a to the brand, DESIGN.md "The One Blue Rule"):
 * a mono letter badge that is the same everywhere, and, in charts, a colour from the brand's chart
 * steps (blue, cool grey, light blue, ...). The letter is always there, so colour is never the only
 * signal. The tone is picked by the meter's position in the list of all meters.
 */
const TONES = [
  { bar: "bg-chart-1 text-primary-foreground", stroke: "var(--chart-1)" },
  { bar: "bg-chart-2 text-background", stroke: "var(--chart-2)" },
  { bar: "bg-chart-3 text-background", stroke: "var(--chart-3)" },
  { bar: "bg-chart-4 text-background", stroke: "var(--chart-4)" },
  { bar: "bg-chart-5 text-background", stroke: "var(--chart-5)" },
] as const;

export function toneFor(index: number) {
  return TONES[((index % TONES.length) + TONES.length) % TONES.length];
}

/** The meter's letter in a small mono badge (DESIGN.md, The meter board). */
export function MeterBadge({ name, className = "" }: { name: string; index?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex h-5 min-w-6 shrink-0 items-center justify-center rounded-md bg-raised px-1 font-mono text-[11px] font-semibold text-foreground ring-1 ring-border ${className}`}
    >
      {badgeLetter(name)}
    </span>
  );
}
