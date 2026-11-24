import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TopicsLine } from "@/components/notifications/topics-line";
import { ThisDevice } from "@/components/settings/push";
import { SettingsColumn, SettingsColumns, SettingsSection } from "@/components/settings/settings-ui";
import { PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getOwnNotifications } from "@/features/notifications/queries";
import { topicsFor, topicsNeedingReminders } from "@/features/notifications/topics";

export const metadata: Metadata = { title: "Notifications" };

async function Content() {
  // Not found for the demo (signed-out visitors, people waiting for approval) and blocked people; the
  // query checks it itself, so nothing is read for them.
  const { setup, access, paused } = await getOwnNotifications();
  return (
    <SettingsColumns>
      <SettingsColumn>
        {setup.configured ? (
          <ThisDevice setup={setup} />
        ) : (
          <SettingsSection label="This device">
            <p className="rounded-2xl border bg-card px-4 py-3.5 text-sm text-muted-foreground">Pushes are not set up on the server yet.</p>
          </SettingsSection>
        )}
        {setup.configured && !setup.switchedOn ? (
          <p className="text-xs text-muted-foreground">The hub is not sending pushes yet. Turn them on here now and they start when the owner switches them on.</p>
        ) : null}
      </SettingsColumn>

      <SettingsColumn>
        <SettingsSection label="You will be told about" note={access.owner ? undefined : "Pushes only, and only for what you can see. Never an amount or a name."}>
          <TopicsLine topics={topicsFor(access)} paused={paused} heldBack={topicsNeedingReminders(access)} />
        </SettingsSection>
        {access.owner ? (
          <p className="text-xs text-muted-foreground">
            The email, the switches and what was sent are in{" "}
            <Link href="/settings/notifications" className="font-medium text-primary underline-offset-2 hover:underline">
              Settings › Notifications
            </Link>
            .
          </p>
        ) : null}
      </SettingsColumn>
    </SettingsColumns>
  );
}

/**
 * Notifications for the person signed in (N.5, DECISIONS C144; owners too): turn pushes on for this
 * device, send yourself a test, see and remove your devices, and read what you will be told about. It
 * is about THIS person only: the devices are their own and the topics come from their grants. Owners
 * keep Settings › Notifications for the hub's switches, the email and the send log.
 */
export default function NotificationsPage() {
  return (
    <>
      <PageHeader title="Notifications" description="Pushes to your own devices." />
      <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
        <Content />
      </Suspense>
    </>
  );
}
