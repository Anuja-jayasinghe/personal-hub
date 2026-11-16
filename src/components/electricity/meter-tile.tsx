import Link from "next/link";
import { BillChip } from "@/components/electricity/bill-chip";
import { LimitChips } from "@/components/electricity/limit-chips";
import { MeterBadge } from "@/components/electricity/meter-tone";
import { CycleFacts, UsageGauge } from "@/components/electricity/usage-gauge";
import type { ElectricityMeter } from "@/db/schema";
import type { MeterData } from "@/features/electricity/meter-data";
import type { MeterLimit } from "@/features/electricity/limits";
import { leftHeadline, usedOfLimit, type LimitUnits } from "@/features/electricity/limits-text";
import { toCents } from "@/lib/decimal";
import { formatDate } from "@/lib/format";

/** One meter in the Both view: units left to its limit, its job (under 120 / allowed to 180 / hold under 120) and one bill chip. A link to the meter's own view. */
export function MeterTile({
  meter,
  toneIndex,
  data,
  href,
  limit,
  units,
}: {
  meter: ElectricityMeter;
  toneIndex: number;
  data: MeterData;
  href: string;
  limit: MeterLimit;
  units: LimitUnits;
}) {
  const { usage, last, lastStatus } = data;
  const headline = limit.known ? leftHeadline(limit) : null;

  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-xl border bg-card p-4 text-card-foreground transition-colors hover:border-foreground/30 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className="flex items-center gap-2 text-sm">
        <MeterBadge name={meter.name} index={toneIndex} />
        <span className="font-medium">{meter.name}</span>
        {meter.accountNumber ? <span className="ml-auto text-xs text-muted-foreground">…{meter.accountNumber.slice(-4)}</span> : null}
      </span>

      <span className="mt-2 text-4xl leading-none font-medium tabular-nums">
        {headline ? (
          <>
            {headline.value} <span className="text-base font-normal text-muted-foreground">{headline.label === "left" ? "units left" : "units over"}</span>
          </>
        ) : (
          <span className="text-muted-foreground">–</span>
        )}
      </span>

      {usage.state === "ok" ? (
        <span className="mt-3 flex flex-col gap-2.5">
          <span className="text-sm text-muted-foreground tabular-nums">{usedOfLimit(limit)}</span>
          <UsageGauge used={usage.units} reference={limit.limit} projected={usage.projected} toneIndex={toneIndex} size="sm" referenceLabel="limit" />
          <CycleFacts days={usage.days} perDay={usage.dailyAverage} from={last ? toCents(last.currentReading) : null} />
        </span>
      ) : (
        <span className="mt-1 text-sm text-muted-foreground">
          {usage.state === "no-reading" ? `Add a reading to count from the ${formatDate(usage.sinceDate)} bill` : "Add a bill to start counting"}
        </span>
      )}

      <span className="mt-2 flex flex-col items-start gap-1.5">
        <LimitChips limit={limit} units={units} />
        {last && lastStatus ? <BillChip status={lastStatus} /> : null}
      </span>
    </Link>
  );
}
