"use client";

import Link from "next/link";
import { useState } from "react";
import { SourceMarker } from "@/components/vehicles/odometer-timeline";
import { pageOf, TIMELINE_FIRST, TIMELINE_MORE } from "@/features/vehicles/overview";

/**
 * The Overview's timeline of recent events (V.2, C149): newest first, five at first and "Show earlier (N)" for
 * the rest. A client component only for that button; the entries arrive as plain values with their links worked
 * out on the server. The marker is the same shape as on the odometer chart (ring = a reading, square = a
 * service, diamond = an emission test); another paper is an outlined rounded square. A reading has no sheet, so
 * it is not a link. The look (issue #237) is the hub's node-and-line language: one line down the left with a
 * node for each event.
 */

export type TimelineRow = {
  key: string;
  marker: "reading" | "service" | "emission" | "paper";
  title: string;
  detail: string | null;
  dateLabel: string;
  /** Where a click goes (the record's sheet), or null for a reading. */
  href: string | null;
};

function Marker({ kind }: { kind: TimelineRow["marker"] }) {
  if (kind === "paper") {
    return (
      <svg viewBox="0 0 14 14" className="size-3.5 shrink-0" aria-hidden focusable="false">
        <rect x="2.5" y="2.5" width="9" height="9" rx="2.5" fill="none" stroke="var(--label)" strokeWidth="1.75" />
      </svg>
    );
  }
  return <SourceMarker source={kind} />;
}

export function OverviewTimeline({ rows }: { rows: readonly TimelineRow[] }) {
  const [shown, setShown] = useState(TIMELINE_FIRST);
  const { visible, hidden } = pageOf(rows, shown);

  return (
    <section aria-label="Timeline" className="flex flex-col gap-1 rounded-[18px] border bg-card p-4 md:rounded-[20px] md:p-5">
      <div className="flex items-baseline justify-between pb-2">
        <h2 className="font-mono text-[10.5px] font-normal tracking-[0.14em] text-label uppercase md:text-[11px]">Timeline</h2>
        <span className="text-[12.5px] text-label">newest first</span>
      </div>
      <ul className="flex flex-col">
        {visible.map((row, i) => {
          const last = i === visible.length - 1 && hidden === 0;
          const inner = (
            <>
              {/* The line runs behind the nodes: from the middle of the first to the middle of the last. */}
              {visible.length > 1 || hidden > 0 ? (
                <span aria-hidden className={`absolute left-[1.0625rem] w-px bg-border ${i === 0 ? "top-[1.3125rem]" : "top-0"} ${last ? "h-[1.3125rem]" : "bottom-0"}`} />
              ) : null}
              <span className="relative z-10 mt-0.5 flex size-[1.375rem] shrink-0 items-center justify-center rounded-full bg-card ring-1 ring-border">
                <Marker kind={row.marker} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold md:text-[14.5px]">{row.title}</span>
                {row.detail ? <span className="text-xs text-muted-foreground md:text-[12.5px]">{row.detail}</span> : null}
              </span>
              <span className="shrink-0 pt-1 font-mono text-[11px] text-label uppercase">{row.dateLabel}</span>
            </>
          );
          const cls = "relative flex min-h-11 gap-3 px-1.5 py-2 text-left md:gap-3.5";
          return (
            <li key={row.key}>
              {row.href ? (
                <Link href={row.href} scroll={false} className={`${cls} rounded-md outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring`}>
                  {inner}
                </Link>
              ) : (
                <div className={cls}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
      {hidden > 0 ? (
        <button type="button" onClick={() => setShown((n) => n + TIMELINE_MORE)} className="mt-1 min-h-11 self-start rounded-md px-1.5 text-[13px] font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
          Show earlier ({hidden})
        </button>
      ) : null}
    </section>
  );
}
