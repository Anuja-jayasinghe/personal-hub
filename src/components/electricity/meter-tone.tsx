import { badgeLetter } from "@/features/electricity/overview";

/**
 * How each meter is told apart on the Electricity page (C78): a letter badge in a colour that stays
 * the same everywhere (tabs, tiles, chart, lists). The letter is always there, so colour is never
 * the only signal. The tone is picked by the meter's position in the list of all meters.
 */
const TONES = [
  { badge: "bg-violet-100 text-violet-900 dark:bg-violet-500/25 dark:text-violet-100", bar: "bg-violet-500 text-white" },
  { badge: "bg-teal-100 text-teal-900 dark:bg-teal-500/25 dark:text-teal-100", bar: "bg-teal-600 text-white" },
  { badge: "bg-amber-100 text-amber-900 dark:bg-amber-500/25 dark:text-amber-100", bar: "bg-amber-600 text-white" },
  { badge: "bg-rose-100 text-rose-900 dark:bg-rose-500/25 dark:text-rose-100", bar: "bg-rose-500 text-white" },
  { badge: "bg-sky-100 text-sky-900 dark:bg-sky-500/25 dark:text-sky-100", bar: "bg-sky-600 text-white" },
] as const;

export function toneFor(index: number) {
  return TONES[((index % TONES.length) + TONES.length) % TONES.length];
}

export function MeterBadge({ name, index, className = "" }: { name: string; index: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-medium ${toneFor(index).badge} ${className}`}
    >
      {badgeLetter(name)}
    </span>
  );
}
