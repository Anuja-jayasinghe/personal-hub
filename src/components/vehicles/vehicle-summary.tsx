import Link from "next/link";
import { ReminderList } from "@/components/reminders/reminder-list";
import { appConfig } from "@/config/app.config";
import { describeDays } from "@/features/reminders/engine";
import { getReminders } from "@/features/reminders/load";
import { getVehicleSummary } from "@/features/vehicles/queries";
import { splitCurrentAndPast } from "@/features/vehicles/renewal-logic";
import { daysBetween } from "@/lib/dates";
import { formatDate, todayInAppTz } from "@/lib/format";

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-card-foreground">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

/** Top of a vehicle's Overview: what is due, last service, and renewals. */
export async function VehicleSummary({ vehicleId }: { vehicleId: string }) {
  const [{ services, renewals }, reminders] = await Promise.all([getVehicleSummary(vehicleId), getReminders()]);
  const today = todayInAppTz();
  const due = reminders.results.filter((r) => r.item.ownerId === vehicleId);
  const lastService = services[0];
  const { current } = splitCurrentAndPast(renewals);

  return (
    <section aria-label="Summary" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Due soon</h2>
        {due.length > 0 ? (
          <ReminderList results={due.slice(0, 5)} />
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Nothing due in the next {Math.max(...appConfig.reminders.leadDays)} days.
          </p>
        )}
        {due.length > 5 ? (
          <Link href="/reminders" className="text-sm underline-offset-2 hover:underline">
            See all reminders
          </Link>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label="Last service">
          {lastService ? (
            <>
              <Link href={`/vehicles/${vehicleId}?tab=services`} className="font-medium underline-offset-2 hover:underline">
                {lastService.serviceType}
              </Link>
              <p className="text-muted-foreground">{formatDate(lastService.serviceDate)}</p>
            </>
          ) : (
            <span className="text-muted-foreground">None recorded</span>
          )}
        </Stat>

        <Stat label="Renewals">
          {current.length > 0 ? (
            <ul className="flex flex-col gap-0.5">
              {current.map((r) => {
                const days = daysBetween(today, r.expiryDate);
                return (
                  <li key={r.id}>
                    <Link href={`/vehicles/${vehicleId}?tab=renewals`} className="underline-offset-2 hover:underline">
                      {r.type}
                    </Link>{" "}
                    <span className={days < 0 ? "text-status-overdue" : "text-muted-foreground"}>
                      · {days < 0 ? `expired ${-days}d ago` : days === 0 ? "expires today" : `${describeDays(days).replace("In ", "")} left`}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <span className="text-muted-foreground">None added</span>
          )}
        </Stat>
      </div>
    </section>
  );
}
