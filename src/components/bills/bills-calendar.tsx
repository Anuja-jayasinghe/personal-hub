import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { emptyDot, ledFill, ledText, todayRing, type LedTone } from "@/components/shared/circuit";
import { titleWithBill } from "@/features/bills/schedule";
import { byDate, monthGrid, type Occurrence } from "@/features/bills/upcoming";
import { formatDate, formatMoney } from "@/lib/format";

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const monthTitle = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** Something already paid this month, shown as a green node (S.5b). */
export type PaidMark = { key: string; date: string; title: string; amount: number | null; href: string };

type Entry = { key: string; title: string; amount: number | null; href: string; tone: LedTone; autopay?: boolean; billDate?: string | null };

const SHORT_AMOUNT = new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 });

/**
 * The Bills calendar in the circuit look (S.5b, C111; design board "One look for time"): each week is a
 * trace, each day a node; a day with something on it lights up (amber due, red late, green paid) with
 * the first name and amount under it, and today is a blue ring. The same entries are listed under the
 * grid, for reading and for screen readers. Plain CSS, no calendar package.
 */
export function BillsCalendar({
  month,
  today,
  occurrences,
  paid = [],
  prevMonth,
  nextMonth,
}: {
  month: string;
  today: string;
  /** Only the entries inside this month. */
  occurrences: Occurrence[];
  /** What was paid inside this month. */
  paid?: PaidMark[];
  /** "YYYY-MM" to link to, or null when that direction is not allowed. */
  prevMonth: string | null;
  nextMonth: string | null;
}) {
  const due = byDate(occurrences);
  const entriesOn = (date: string): Entry[] => [
    ...(due.get(date) ?? []).map((o) => ({ key: o.key, title: o.title, amount: o.amount, href: o.href, tone: (o.overdue ? "late" : "due") as LedTone, autopay: o.autopay, billDate: o.billDate })),
    ...paid.filter((p) => p.date === date).map((p) => ({ key: p.key, title: p.title, amount: p.amount, href: p.href, tone: "paid" as LedTone })),
  ];
  const weeks = monthGrid(month);
  const allDates = [...new Set([...due.keys(), ...paid.map((p) => p.date)])].sort();
  const toneOf = (entries: Entry[]): LedTone => (entries.some((e) => e.tone === "late") ? "late" : entries.some((e) => e.tone === "due") ? "due" : "paid");
  const navBtn =
    "inline-flex size-9 items-center justify-center rounded-full border text-muted-foreground outline-none hover:border-primary/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <section
      aria-labelledby="calendar-title"
      className="flex flex-col gap-3 rounded-3xl border border-raised bg-deepest bg-[radial-gradient(var(--card)_1px,transparent_1px)] bg-size-[14px_14px] p-4 md:p-5"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="calendar-title" className="font-display text-xl font-semibold tracking-tight">
          {monthTitle.format(new Date(`${month}-01T00:00:00Z`))}
        </h2>
        <span className="flex gap-1.5">
          {prevMonth ? (
            <Link href={`/bills?month=${prevMonth}`} scroll={false} className={navBtn} aria-label="Previous month">
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
          ) : null}
          {nextMonth ? (
            <Link href={`/bills?month=${nextMonth}`} scroll={false} className={navBtn} aria-label="Next month">
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : null}
        </span>
        <span aria-hidden className="ml-auto hidden flex-wrap gap-3 text-xs text-muted-foreground sm:flex">
          {(["paid", "due", "late"] as const).map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className={`size-2.5 rounded-full ${ledFill[t]}`} />
              {t}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-full ${todayRing}`} />
            today
          </span>
        </span>
      </div>

      <div aria-hidden className="grid grid-cols-7">
        {WEEKDAYS.map((d) => (
          <span key={d} className="px-1.5 font-mono text-[9.5px] tracking-[0.14em] text-quiet sm:px-2.5">
            {d}
          </span>
        ))}
      </div>
      <div aria-hidden className="flex flex-col">
        {weeks.map((week, w) => (
          <div key={w} className="relative grid h-16 grid-cols-7 sm:h-[84px]">
            <span className="absolute inset-x-3 top-[27px] h-0.5 bg-card sm:inset-x-5 sm:top-[29px]" />
            {week.map((date, i) => {
              if (!date) return <span key={`b-${w}-${i}`} />;
              const entries = entriesOn(date);
              const isToday = date === today;
              const tone = entries.length > 0 ? toneOf(entries) : null;
              const past = date < today && entries.length === 0;
              return (
                <span key={date} className={`relative flex min-w-0 flex-col gap-0.5 px-1.5 pt-1 sm:px-2.5 ${past ? "opacity-50" : ""}`}>
                  <span className={`font-mono text-[10px] ${isToday ? "font-semibold text-primary" : "text-label"}`}>{Number(date.slice(8))}</span>
                  <span
                    className={`absolute top-[22px] left-2.5 rounded-full sm:top-6 sm:left-3.5 ${
                      tone ? `size-3 sm:size-3.5 ${ledFill[tone]}` : isToday ? `size-3 ${todayRing}` : `top-[25px] size-1.5 sm:top-[27px] ${emptyDot}`
                    } ${tone && isToday ? "ring-2 ring-primary ring-offset-2 ring-offset-deepest" : ""}`}
                  />
                  {entries.length > 0 ? (
                    <>
                      <span className={`mt-6 hidden truncate text-[11px] leading-tight sm:block ${ledText[toneOf(entries)]}`}>{entries[0].title}</span>
                      <span className="hidden font-mono text-[10px] text-label sm:block">
                        {entries[0].amount !== null ? SHORT_AMOUNT.format(entries[0].amount / 100) : ""}
                        {entries.length > 1 ? ` +${entries.length - 1}` : ""}
                      </span>
                    </>
                  ) : isToday ? (
                    <span className="mt-6 hidden text-[11px] text-primary sm:block">Today</span>
                  ) : null}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      {allDates.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing due or paid this month.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-raised rounded-2xl border bg-card text-sm">
          {allDates.flatMap((date) =>
            entriesOn(date).map((e) => (
              <li key={e.key} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3.5 py-2">
                <Link href={e.href} className="flex min-w-0 basis-full items-center gap-3 font-medium underline-offset-2 hover:underline sm:flex-1 sm:basis-0">
                  <span aria-hidden className={`size-2 shrink-0 rounded-full ${ledFill[e.tone]}`} />
                  <span className="truncate">{titleWithBill(e.title, e.billDate)}</span>
                </Link>
                <span className="pl-5 font-mono text-xs text-muted-foreground sm:pl-0">
                  {e.tone === "paid" ? "paid " : e.tone === "late" ? "late, was due " : "due "}
                  {formatDate(date)}
                  {e.autopay ? " · autopay" : ""}
                  {e.amount !== null ? ` · ${formatMoney(e.amount / 100)}` : ""}
                </span>
              </li>
            )),
          )}
        </ul>
      )}
    </section>
  );
}
