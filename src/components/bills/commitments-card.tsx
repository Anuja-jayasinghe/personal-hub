import { FREQUENCY_LABELS } from "@/features/bills/schedule";
import type { Commitments } from "@/features/bills/upcoming";
import { formatMoney } from "@/lib/format";

const money = (hundredths: number) => formatMoney(hundredths / 100);

/** What your recurring bills and subscriptions cost per month (and per year), item by item. */
export function CommitmentsCard({ data }: { data: Commitments }) {
  return (
    <section aria-labelledby="commitments-title" className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div>
        <h2 id="commitments-title" className="font-mono text-[10.5px] font-normal tracking-[0.14em] text-label uppercase">
          Monthly commitments
        </h2>
        <p className="text-xs text-muted-foreground">Recurring items with a usual amount, as a monthly figure.</p>
      </div>
        {data.lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">Give your recurring bills and subscriptions a usual amount to see what they add up to.</p>
        ) : (
          <>
            <div>
              <p className="flex items-baseline gap-2"><span className="font-display text-3xl font-semibold tracking-tight">{money(data.total)}</span> <span className="text-sm text-muted-foreground">a month</span></p>
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
    </section>
  );
}
