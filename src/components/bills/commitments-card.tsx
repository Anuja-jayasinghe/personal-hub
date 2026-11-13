import { Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FREQUENCY_LABELS } from "@/features/bills/schedule";
import type { Commitments } from "@/features/bills/upcoming";
import { formatMoney } from "@/lib/format";

const money = (hundredths: number) => formatMoney(hundredths / 100);

/** What your recurring bills and subscriptions cost per month (and per year), item by item. */
export function CommitmentsCard({ data }: { data: Commitments }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="size-4" aria-hidden /> Monthly commitments
        </CardTitle>
        <CardDescription>Recurring items with a usual amount, converted to a monthly figure.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {data.lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">Give your recurring bills and subscriptions a usual amount to see what they add up to.</p>
        ) : (
          <>
            <div>
              <p className="text-2xl font-semibold">{money(data.total)} <span className="text-sm font-normal text-muted-foreground">a month</span></p>
              <p className="text-sm text-muted-foreground">
                About {money(data.perYear)} a year · Bills {money(data.bills)} · Subscriptions {money(data.subscriptions)}
              </p>
            </div>
            <details className="rounded-md border">
              <summary className="cursor-pointer px-3 py-1.5 text-sm text-muted-foreground">Show each item ({data.lines.length})</summary>
              <ul className="flex flex-col divide-y border-t text-sm">
                {data.lines.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-3 px-3 py-1.5">
                    <span className="font-medium">{l.name}</span>
                    <span className="text-muted-foreground">
                      {money(l.amount)} · {FREQUENCY_LABELS[l.frequency].toLowerCase()} · <span className="text-foreground">{money(l.monthly)} a month</span>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
        {data.withoutAmount.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Not counted, no usual amount: {data.withoutAmount.map((w) => w.name).join(", ")}.
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">One-off items and electricity bills (their amount varies) are not included.</p>
      </CardContent>
    </Card>
  );
}
