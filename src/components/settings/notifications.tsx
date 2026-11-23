import { PushLiveSwitch } from "@/components/settings/push";
import { RowCard, Row, RowMeta } from "@/components/settings/settings-ui";
import type { PreviewDay } from "@/features/notifications/planner";
import type { RecentNotification } from "@/features/notifications/queries";
import type { Channel } from "@/features/notifications/steps";
import { appConfig } from "@/config/app.config";
import { dayMonth, daysBetween, todayIn } from "@/lib/dates";

/**
 * Settings › Notifications (N.1, DECISIONS C139). Display only: the page reads the data and passes it in.
 * Email says "not set up yet" until N.2; the iPhone row has its switch since N.3 (C140).
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayLabel(date: string, today: string): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `${WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]} ${dayMonth(date)}`;
}

const CHANNEL_TAG: Record<Channel, string> = { email: "Email", push: "iPhone" };

/**
 * The two ways the hub reaches you. Email waits for N.2. The iPhone row carries the switch that makes
 * the morning run's pushes real (N.3, C140): off, it only logs what it would push.
 */
export function ChannelRows({ push }: { push: { configured: boolean; switchedOn: boolean } }) {
  return (
    <RowCard>
      <Row label="Email" hint="plans ahead: renewals 30 days before, services 14, electricity bills 7" end={<RowMeta tone="quiet">Not set up yet</RowMeta>} />
      <Row
        label="iPhone"
        hint={
          push.configured
            ? `acts now: the day before or on the day, and once on the first day overdue${push.switchedOn ? "" : " · off: logged, not sent"}`
            : "acts now: the day before or on the day, and once on the first day overdue"
        }
        end={push.configured ? <PushLiveSwitch on={push.switchedOn} configured /> : <RowMeta tone="quiet">Not set up yet</RowMeta>}
      />
    </RowCard>
  );
}

/**
 * The next 30 days as a line of day nodes (DESIGN.md: node-and-line), each with what would go out
 * that morning. Days with nothing are left out: nothing new, nothing sent.
 */
export function ComingUpLine({ days, today }: { days: PreviewDay[]; today: string }) {
  if (days.length === 0) {
    return <p className="rounded-2xl border bg-card px-4 py-3.5 text-sm text-muted-foreground">Nothing in the next 30 days. A quiet month sends nothing.</p>;
  }
  return (
    <ol className="relative flex flex-col gap-4 rounded-2xl border bg-card px-4 py-4">
      <span aria-hidden className="absolute top-6 bottom-6 left-[1.4rem] w-0.5 bg-border" />
      {days.map((day) => (
        <li key={day.date} className="relative flex gap-3.5">
          <span aria-hidden className={`relative mt-1 size-3 shrink-0 rounded-full border-2 border-card ${day.date === today ? "bg-primary" : "bg-quiet"}`} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="font-mono text-[10.5px] tracking-[0.14em] text-label uppercase">{dayLabel(day.date, today)}</span>
            {day.messages.map((m) => (
              <div key={m.channel} className="flex min-w-0 flex-col gap-0.5">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="shrink-0 font-mono text-[10px] tracking-[0.12em] text-primary uppercase">{CHANNEL_TAG[m.channel]}</span>
                  <span className="truncate text-[15px] font-semibold">{m.notices.length === 1 ? m.notices[0].title : `${m.notices.length} things`}</span>
                </span>
                {m.notices.length > 1 ? (
                  <ul className="flex flex-col pl-[3.4rem] text-[12.5px] text-muted-foreground">
                    {m.notices.map((n) => (
                      <li key={n.dedupeKey} className="truncate">
                        {n.title}
                      </li>
                    ))}
                  </ul>
                ) : m.channel === "push" ? (
                  <span className="truncate pl-[3.4rem] text-[12.5px] text-muted-foreground">{m.notices[0].body}</span>
                ) : null}
              </div>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

function StatusTag({ row }: { row: RecentNotification }) {
  switch (row.shown) {
    case "dry_run":
      // A dry run of a channel that is not switched on yet.
      return <RowMeta tone="quiet">Not sent · dry run</RowMeta>;
    case "pending":
      return <RowMeta tone="blue">Sending</RowMeta>;
    case "unknown":
      // Started more than 10 minutes ago and never finished: it may or may not have arrived.
      return <span className="shrink-0 font-mono text-[10.5px] tracking-[0.12em] text-status-soon uppercase">Unknown</span>;
    case "sent":
      return <RowMeta tone="ok">Sent</RowMeta>;
    case "failed":
      return <span className="shrink-0 font-mono text-[10.5px] tracking-[0.12em] text-status-overdue uppercase">Failed</span>;
  }
}

function RecentRow({ row }: { row: RecentNotification }) {
  const day = todayIn(appConfig.timeZone, row.sentAt ?? row.createdAt);
  return (
    <Row
      label={<span className="block truncate">{row.title}</span>}
      hint={
        <>
          {CHANNEL_TAG[row.channel]} · {dayMonth(day)}
          {row.error ? <span className="block text-status-overdue">{row.error}</span> : null}
        </>
      }
      end={<StatusTag row={row} />}
    />
  );
}

/** How many rows show before the rest are tucked away (rarely looked at). */
const SHOWN = 5;

/** The last rows of the send log; beyond the first few they are tucked behind "Show all". */
export function RecentList({ rows }: { rows: RecentNotification[] }) {
  if (rows.length === 0) {
    return <p className="rounded-2xl border bg-card px-4 py-3.5 text-sm text-muted-foreground">Nothing logged yet. The run looks every morning around 07:30.</p>;
  }
  const rest = rows.slice(SHOWN);
  return (
    <RowCard>
      {rows.slice(0, SHOWN).map((r) => (
        <RecentRow key={r.id} row={r} />
      ))}
      {rest.length > 0 ? (
        <details className="group/r">
          <summary className="flex min-h-12 cursor-pointer list-none items-center text-sm font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring group-open/r:hidden [&::-webkit-details-marker]:hidden">
            Show {rest.length} more
          </summary>
          <div className="flex flex-col divide-y divide-raised">
            {rest.map((r) => (
              <RecentRow key={r.id} row={r} />
            ))}
          </div>
        </details>
      ) : null}
    </RowCard>
  );
}
