import { CalendarDays, Flag, Gauge } from "lucide-react";
import { toneFor } from "@/components/electricity/meter-tone";
import { gaugeScale, kwhParts } from "@/features/electricity/overview";

/**
 * One bar that answers "is this cycle running higher or lower than last time?" (C81): the filled part
 * is what has been used since the last bill, the faded part is where a full cycle would end at the
 * current pace, and the thin mark is what the last bill billed. The figures sit under it, with the
 * same swatches, so the bar needs no sentence. All figures are hundredths of a kWh.
 */
export function UsageGauge({
  used,
  reference,
  projected,
  toneIndex,
  size = "md",
}: {
  used: number;
  reference: number | null;
  projected: number | null;
  toneIndex: number;
  size?: "sm" | "md";
}) {
  const g = gaugeScale({ used, reference, projected });
  const bar = toneFor(toneIndex).bar.split(" ")[0]; // the fill colour only
  const kwh = (v: number) => Math.round(v / 100).toLocaleString("en-US"); // whole kWh: the bar is for a quick read
  const label = `Used ${kwh(used)} kWh since the last bill${
    projected !== null ? `; about ${kwh(projected)} kWh by the end of the cycle at this pace` : ""
  }${reference !== null ? `; the last bill was ${kwh(reference)} kWh` : ""}.`;

  return (
    <div className="flex flex-col gap-1.5">
      <div role="img" aria-label={label} className={`relative rounded-full bg-muted ${size === "md" ? "h-3.5" : "h-2.5"}`}>
        {projected !== null && g.projectedPct > g.usedPct ? (
          <div className={`absolute inset-y-0 left-0 rounded-full ${bar} opacity-40`} style={{ width: `${g.projectedPct}%` }} />
        ) : null}
        <div className={`absolute inset-y-0 left-0 rounded-full ${bar}`} style={{ width: `${g.usedPct}%` }} />
        {g.referencePct !== null ? (
          <div className="absolute -inset-y-1 w-0.5 rounded-full bg-foreground" style={{ left: `calc(${g.referencePct}% - 1px)` }} />
        ) : null}
      </div>
      <ul aria-hidden className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
        <li className="flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${bar}`} /> {kwh(used)} used
        </li>
        {projected !== null && projected > used ? (
          <li className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${bar} opacity-40`} /> ~{kwh(projected)} at this pace
          </li>
        ) : null}
        {reference !== null ? (
          <li className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 rounded-full bg-foreground" /> {kwh(reference)} last bill
          </li>
        ) : null}
      </ul>
    </div>
  );
}

/** Three short facts with icons instead of a sentence: days since the bill, kWh a day, and the bill reading it started from. */
export function CycleFacts({ days, perDay, from }: { days: number | null; perDay: number | null; from: number | null }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground tabular-nums">
      {days !== null ? (
        <li className="flex items-center gap-1.5">
          <CalendarDays className="size-4" aria-hidden /> {days} day{days === 1 ? "" : "s"}
        </li>
      ) : null}
      {perDay !== null ? (
        <li className="flex items-center gap-1.5">
          <Gauge className="size-4" aria-hidden /> {kwhParts(perDay).value} a day
        </li>
      ) : null}
      {from !== null ? (
        <li className="flex items-center gap-1.5">
          <Flag className="size-4" aria-hidden /> from {kwhParts(from).value}
        </li>
      ) : null}
    </ul>
  );
}
