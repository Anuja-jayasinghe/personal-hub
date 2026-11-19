/**
 * The "circuit" look shared by the Bills calendar, the Reminders strip and Home's next-30-days line
 * (S.5b, C111; design board "One look for time"): days are nodes on a trace, and a day with something
 * on it lights up like an LED in its state colour with a soft halo; today is a blue ring.
 */
export type LedTone = "paid" | "due" | "late" | "check" | "soon";

export const ledFill: Record<LedTone, string> = {
  paid: "bg-status-ok shadow-[0_0_0_4px_color-mix(in_oklab,var(--status-ok)_18%,transparent)]",
  due: "bg-status-soon-mark shadow-[0_0_0_4px_color-mix(in_oklab,var(--status-soon-mark)_18%,transparent)]",
  late: "bg-status-overdue shadow-[0_0_0_4px_color-mix(in_oklab,var(--status-overdue)_20%,transparent)]",
  check: "bg-label",
  soon: "bg-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_16%,transparent)]",
};

export const ledText: Record<LedTone, string> = {
  paid: "text-status-ok",
  due: "text-status-soon",
  late: "text-status-overdue",
  check: "text-muted-foreground",
  soon: "text-primary",
};

/** Today: a ring in the brand blue around the deep background. */
export const todayRing = "bg-deepest ring-[2.5px] ring-primary shadow-[0_0_0_5px_color-mix(in_oklab,var(--primary)_16%,transparent)]";

/** An empty day: a small quiet dot. */
export const emptyDot = "bg-border";
