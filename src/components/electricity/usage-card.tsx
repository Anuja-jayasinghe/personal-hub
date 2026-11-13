import { Zap } from "lucide-react";
import Link from "next/link";
import { UsageSummary } from "@/components/electricity/usage-summary";
import { EmptyState } from "@/components/shell/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { appConfig } from "@/config/app.config";
import { combineUsage, sinceLastBill } from "@/features/electricity/since-bill";
import { listAllBills, listAllReadings, listMeters } from "@/features/electricity/queries";
import { formatKwh, toReading } from "@/features/electricity/usage";
import { toCents } from "@/lib/decimal";

/** Home card: units used since the last bill, per active meter and combined. Use inside <Suspense>. */
export async function UsageCard() {
  const [meters, bills, readings] = await Promise.all([listMeters(false), listAllBills(), listAllReadings()]);
  const cycle = appConfig.electricity.billingCycleDays;

  const rows = meters.map((m) => ({
    meter: m,
    usage: sinceLastBill(
      bills.filter((b) => b.meterId === m.id).map((b) => ({ billDate: b.billDate, readingDate: b.readingDate, currentReading: toCents(b.currentReading), createdAt: b.createdAt })),
      readings.filter((r) => r.meterId === m.id).map(toReading),
      cycle,
    ),
  }));
  const combined = rows.length > 1 ? combineUsage(rows.map((r) => r.usage)) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="size-4" aria-hidden /> Electricity since last bill
        </CardTitle>
        <CardDescription>Units used, days elapsed and daily average.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.length === 0 ? (
          <EmptyState title="No meter yet" hint="Add your meters, readings and bills on the Electricity page; the usage since your last bill shows here." />
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map(({ meter, usage }) => (
              <li key={meter.id} className="rounded-lg border p-3">
                <p className="mb-1 text-sm font-medium">{meter.name}</p>
                <UsageSummary usage={usage} />
              </li>
            ))}
          </ul>
        )}
        {combined ? (
          <p className="text-sm">
            <span className="font-medium">All meters:</span> {formatKwh(combined.units)}, about {formatKwh(combined.dailyAverage)} a day, roughly{" "}
            {formatKwh(combined.projected)} over {cycle} days
            {combined.counted < combined.of ? <span className="text-muted-foreground"> (counting {combined.counted} of {combined.of} meters that have a figure)</span> : null}.
          </p>
        ) : null}
        <Link href="/electricity" className="text-sm font-medium underline-offset-2 hover:underline">
          Open Electricity
        </Link>
      </CardContent>
    </Card>
  );
}
