import { ChequeCard } from "@/components/cheques/cheque-card";
import { EmptyState } from "@/components/shell/page-header";
import type { Attachment, Cheque } from "@/db/schema";
import { finished, inTheBank, viewOf, waitingFirst } from "@/features/cheques/logic";
import { dayMonthIn } from "@/lib/dates";
import { toCents } from "@/lib/decimal";
import { formatMoney } from "@/lib/format";

type Photo = Pick<Attachment, "id" | "fileName" | "mimeType">;

/**
 * The Cheques page below its title (issue #178): what is waiting in one line, then the waiting cheques
 * (the one to deposit first on top), the ones in the bank, and the finished ones tucked away. The page
 * checks the owner and loads the data; this only draws it.
 */
export function ChequesView({ rows, photos, today }: { rows: readonly Cheque[]; photos: ReadonlyMap<string, Photo[]>; today: string }) {
  const waiting = waitingFirst(rows);
  const bank = inTheBank(rows);
  const done = finished(rows);
  const states = waiting.map((c) => viewOf(c, today).state);
  const stale = states.filter((s) => s === "stale").length;
  // Ready: the date has come and the bank would still take it (a stale one cannot be deposited any more).
  const ready = waiting.filter((c, i) => c.chequeDate <= today && states[i] !== "stale").length;
  const closing = states.filter((s) => s === "going-stale").length;
  const waitingCents = waiting.reduce((sum, c) => sum + toCents(c.amount), 0);
  const next = waiting.find((c) => c.chequeDate > today);

  const card = (c: Cheque) => <ChequeCard key={c.id} cheque={c} photos={photos.get(c.id) ?? []} today={today} />;
  const h2 = "font-mono text-[10.5px] font-normal tracking-[0.14em] text-label uppercase";

  return (
    <>
      {/* With no cheques at all the empty state below takes this place (DESIGN.md, Layout). */}
      {rows.length > 0 ? (
      <section aria-label="Cheques waiting" className="flex flex-col gap-1 rounded-3xl border border-border bg-deepest p-4 md:p-5 dark:border-raised">
        <div className="flex items-baseline font-mono text-[10.5px] tracking-[0.14em] text-label uppercase">
          <span>Waiting to be deposited</span>
          <span className="ml-auto">
            {waiting.length} cheque{waiting.length === 1 ? "" : "s"}
          </span>
        </div>
        <p className="font-display text-4xl leading-none font-semibold tracking-tight md:text-5xl">{formatMoney(waitingCents / 100)}</p>
        <p className="text-sm text-muted-foreground">
          {waiting.length === 0
            ? "Nothing waiting."
            : [
                ready > 0 ? `${ready} can be deposited now` : next ? `The next one can be deposited ${dayMonthIn(next.chequeDate, today)}` : "",
                closing > 0 ? `${closing} close to going stale` : "",
                stale > 0 ? `${stale} went stale` : "",
              ]
                .filter(Boolean)
                .join(", ") + "."}
        </p>
      </section>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="No cheques yet"
          hint="Add a cheque you have received, with the date written on it. hub reminds you when it can be deposited, and again before it goes stale six months later."
        />
      ) : (
        <>
          {waiting.length > 0 ? (
            <section aria-label="Waiting" className="flex flex-col gap-3">
              <h2 className={h2}>Waiting</h2>
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-2">{waiting.map(card)}</ul>
            </section>
          ) : null}
          {bank.length > 0 ? (
            <section aria-label="In the bank" className="flex flex-col gap-3">
              <h2 className={h2}>Deposited, not cleared yet</h2>
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-2">{bank.map(card)}</ul>
            </section>
          ) : null}
          {done.length > 0 ? (
            <details>
              <summary className={`flex min-h-11 cursor-pointer items-center ${h2}`}>Earlier cheques ({done.length})</summary>
              <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-2">{done.map(card)}</ul>
            </details>
          ) : null}
        </>
      )}
    </>
  );
}
