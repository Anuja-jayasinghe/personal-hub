import Link from "next/link";
import { BillChip } from "@/components/electricity/bill-chip";
import { MeterBadge } from "@/components/electricity/meter-tone";
import { CycleFacts, UsageGauge } from "@/components/electricity/usage-gauge";
import type { ElectricityMeter } from "@/db/schema";
import type { MeterData } from "@/features/electricity/meter-data";
import { kwhParts } from "@/features/electricity/overview";
import { toCents } from "@/lib/decimal";
import { formatDate } from "@/lib/format";

/** One meter in the Both view: a single big number (used since its last bill) and one status chip. A link to the meter's own view. */
export function MeterTile({ meter, toneIndex, data, href }: { meter: ElectricityMeter; toneIndex: number; data: MeterData; href: string }) {
  const { usage, last, lastStatus } = data;
  const used = usage.state === "ok" ? kwhParts(usage.units) : null;

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
        {used ? (
          <>
            {used.value} <span className="text-base font-normal text-muted-foreground">{used.unit}</span>
          </>
        ) : (
          <span className="text-muted-foreground">–</span>
        )}
      </span>

      {usage.state === "ok" ? (
        <span className="mt-3 flex flex-col gap-2.5">
          <UsageGauge used={usage.units} reference={last ? toCents(last.units) : null} projected={usage.projected} toneIndex={toneIndex} size="sm" />
          <CycleFacts days={usage.days} perDay={usage.dailyAverage} from={last ? toCents(last.currentReading) : null} />
        </span>
      ) : (
        <span className="mt-1 text-sm text-muted-foreground">
          {usage.state === "no-reading" ? `Add a reading to count from the ${formatDate(usage.sinceDate)} bill` : "Add a bill to start counting"}
        </span>
      )}

      {last && lastStatus ? (
        <span className="mt-2">
          <BillChip status={lastStatus} />
        </span>
      ) : null}
    </Link>
  );
}
