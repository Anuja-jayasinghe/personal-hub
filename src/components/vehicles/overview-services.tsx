"use client";

import Link from "next/link";
import { useState } from "react";
import { SourceMarker } from "@/components/vehicles/odometer-timeline";
import { SERVICES_ANCHOR } from "@/features/vehicles/tabs";

/**
 * The Overview's Services card (V.2, C149; V.3, C150): the latest few services, each opening its detail sheet,
 * and "Show all N" that opens the whole history right here, newest first (it was the Services tab's list before the
 * tab went). A client component only for that button; the rows arrive as plain values with their links worked out on
 * the server. It carries the `#services` anchor that old `?tab=services` links scroll to.
 */

export type ServiceRow = {
  id: string;
  title: string;
  /** Date, odometer and garage, already worded. */
  detail: string;
  /** The cost, already formatted, or null. */
  cost: string | null;
  href: string;
};

const label = "font-mono text-[10.5px] font-normal tracking-[0.14em] text-label uppercase md:text-[11px]";

export function OverviewServices({ rows, firstShown }: { rows: readonly ServiceRow[]; firstShown: number }) {
  const [all, setAll] = useState(false);
  const visible = all ? rows : rows.slice(0, firstShown);
  const more = rows.length > firstShown;

  return (
    <section id={SERVICES_ANCHOR} aria-label="Services" className="flex scroll-mt-4 flex-col gap-1 rounded-[18px] border bg-card p-4 md:rounded-[20px] md:p-5">
      <div className="flex items-baseline justify-between pb-2">
        <h2 className={label}>Services</h2>
        {more ? (
          <button
            type="button"
            onClick={() => setAll((v) => !v)}
            aria-expanded={all}
            className="-my-2 min-h-11 rounded-md px-1 text-[13px] font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {all ? "Show fewer" : `Show all ${rows.length}`}
          </button>
        ) : null}
      </div>
      <ul className="flex flex-col">
        {visible.map((s) => (
          <li key={s.id} className="border-b border-border/60 last:border-b-0">
            <Link
              href={s.href}
              scroll={false}
              className="flex min-h-11 items-center gap-3 rounded-md px-1.5 py-2.5 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring md:gap-3.5"
            >
              <SourceMarker source="service" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold md:text-[14.5px]">{s.title}</span>
                <span className="text-xs text-muted-foreground md:text-[12.5px]">{s.detail}</span>
              </span>
              {s.cost ? <span className="shrink-0 font-mono text-xs text-muted-foreground">{s.cost}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
