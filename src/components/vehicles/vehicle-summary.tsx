import { getRules } from "@/features/settings/queries";
import Link from "next/link";
import { ReminderList } from "@/components/reminders/reminder-list";
import { DaysRing } from "@/components/shared/days-ring";
import { getReminders } from "@/features/reminders/load";
import { getVehicleSummary } from "@/features/vehicles/queries";
import { splitCurrentAndPast } from "@/features/vehicles/renewal-logic";
import { daysBetween } from "@/lib/dates";
import { formatDate, todayInAppTz } from "@/lib/format";

/** Days a renewal usually runs, for how full its ring is: from its start date when known, otherwise a year. */
function spanOf(startDate: string | null, expiryDate: string): number {
  return startDate ? Math.max(1, daysBetween(startDate, expiryDate)) : 365;
}

/**
 * Top of a vehicle's Overview (R.5a; board HVehicleForms): the next renewal as a big countdown ring, a
 * small ring for each current renewal, the last service, and what is due.
 */
export async function VehicleSummary({ vehicleId }: { vehicleId: string }) {
  const rules = await getRules();
  const [{ services, renewals }, reminders] = await Promise.all([getVehicleSummary(vehicleId), getReminders()]);
  const today = todayInAppTz();
  const due = reminders.results.filter((r) => r.item.ownerId === vehicleId);
  const lastService = services[0];
  const current = splitCurrentAndPast(renewals)
    .current.map((r) => ({ ...r, days: daysBetween(today, r.expiryDate), span: spanOf(r.startDate, r.expiryDate) }))
    .sort((a, b) => a.days - b.days);
  const next = current[0];
  const renewalsHref = `/vehicles/${vehicleId}?tab=renewals`;

  return (
    <section aria-label="Summary" className="flex flex-col gap-3 md:gap-4">
      {next ? (
        <Link
          href={renewalsHref}
          className="flex items-center gap-4 rounded-3xl border border-raised bg-deepest p-4 outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring md:p-5"
        >
          <DaysRing days={next.days} ofDays={next.span} size={112} label={`${next.type}: ${next.days < 0 ? `${-next.days} days late` : `${next.days} days left`}`} />
          <span className="min-w-0">
            <span className={`block font-mono text-[10.5px] tracking-[0.14em] uppercase ${next.days <= 30 ? "text-status-soon" : "text-label"}`}>
              {next.days < 0 ? "Expired" : "Next up"}
            </span>
            <span className="block font-display text-[22px] leading-tight font-semibold tracking-tight">{next.type}</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {next.days < 0 ? "ended" : "ends"} {formatDate(next.expiryDate)}
            </span>
          </span>
        </Link>
      ) : (
        <Link
          href={renewalsHref}
          className="flex items-center gap-3 rounded-2xl border border-dashed p-4 text-sm outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex-1">
            <span className="block font-semibold">No renewals yet</span>
            <span className="block text-muted-foreground">Add the revenue licence, insurance and emission test to get a countdown for each.</span>
          </span>
          <span className="font-semibold text-primary">Add</span>
        </Link>
      )}

      {current.length > 1 ? (
        <ul className="grid grid-cols-3 gap-2.5">
          {current.map((r) => (
            <li key={r.id}>
              <Link
                href={renewalsHref}
                className="flex flex-col items-center gap-1.5 rounded-2xl border bg-card px-1.5 py-3 text-center outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <DaysRing days={r.days} ofDays={r.span} label={`${r.type}: ${r.days < 0 ? `${-r.days} days late` : `${r.days} days left`}`} />
                <span className="text-[13px] leading-tight font-semibold">{r.type}</span>
                <span className="font-mono text-[10px] text-label uppercase">{formatDate(r.expiryDate)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 md:gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="font-mono text-[10.5px] font-normal tracking-[0.14em] text-label uppercase">Due soon</h2>
          {due.length > 0 ? (
            <ReminderList results={due.slice(0, 5)} />
          ) : (
            <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">
              Nothing due in the next {Math.max(...rules.leadDays)} days.
            </p>
          )}
          {due.length > 5 ? (
            <Link href="/reminders" className="text-sm font-semibold text-primary hover:underline">
              See all reminders
            </Link>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="font-mono text-[10.5px] font-normal tracking-[0.14em] text-label uppercase">Last service</h2>
          <div className="rounded-2xl border bg-card p-4 text-sm">
            {lastService ? (
              <>
                <Link href={`/vehicles/${vehicleId}?tab=services`} className="font-semibold hover:underline">
                  {lastService.serviceType}
                </Link>
                <p className="font-mono text-[11px] text-label uppercase">{formatDate(lastService.serviceDate)}</p>
              </>
            ) : (
              <span className="text-muted-foreground">None recorded</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
