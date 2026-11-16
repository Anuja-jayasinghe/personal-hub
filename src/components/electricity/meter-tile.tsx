import Link from "next/link";
import { BillChip } from "@/components/electricity/bill-chip";
import { MeterBadge } from "@/components/electricity/meter-tone";
import type { ElectricityMeter } from "@/db/schema";
import type { MeterData } from "@/features/electricity/meter-data";
import { kwhParts } from "@/features/electricity/overview";
import { formatKwh } from "@/features/electricity/usage";
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
      <span className="text-sm text-muted-foreground">
        {usage.state === "ok"
          ? `used since the bill on ${formatDate(usage.sinceDate)}`
          : usage.state === "no-reading"
            ? `no reading since the bill on ${formatDate(usage.sinceDate)}`
            : "no bill yet"}
      </span>
      {last ? <span className="text-sm text-muted-foreground">from the bill reading of {formatKwh(toCents(last.currentReading))}</span> : null}

      {last && lastStatus ? (
        <span className="mt-2">
          <BillChip status={lastStatus} />
        </span>
      ) : null}
    </Link>
  );
}
