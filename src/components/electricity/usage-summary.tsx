import { appConfig } from "@/config/app.config";
import type { SinceLastBill } from "@/features/electricity/since-bill";
import { formatKwh } from "@/features/electricity/usage";
import { formatDate } from "@/lib/format";

/** "Since your last bill" for one meter: units, days, daily average and the pace over a billing cycle. */
export function UsageSummary({ usage }: { usage: SinceLastBill }) {
  if (usage.state === "no-bill") {
    return <p className="text-sm text-muted-foreground">No bill yet. Add a bill to see the usage since it.</p>;
  }
  if (usage.state === "no-reading") {
    return (
      <p className="text-sm text-muted-foreground">
        No readings since the last bill ({formatDate(usage.sinceDate)}). Add a reading to see how much you have used.
      </p>
    );
  }
  const days = `${usage.days} day${usage.days === 1 ? "" : "s"}`;
  return (
    <div className="text-sm">
      <p>
        <span className="text-lg font-semibold">{formatKwh(usage.units)}</span> used in {days}
        <span className="text-muted-foreground">
          {" "}
          ({formatDate(usage.sinceDate)} to {formatDate(usage.asOf)})
        </span>
      </p>
      {usage.dailyAverage !== null && usage.projected !== null ? (
        <p className="text-muted-foreground">
          About {formatKwh(usage.dailyAverage)} a day, so roughly {formatKwh(usage.projected)} over {appConfig.electricity.billingCycleDays} days.
        </p>
      ) : null}
    </div>
  );
}
