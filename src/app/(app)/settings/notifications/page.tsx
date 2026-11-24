import type { Metadata } from "next";
import { Suspense } from "react";
import { OwnerOnly } from "@/components/settings/owner-only";
import { ChannelRows, ComingUpLine, RecentList } from "@/components/settings/notifications";
import { EmailRow } from "@/components/settings/notifications-email";
import { ThisDevice } from "@/components/settings/push";
import { SettingsColumn, SettingsColumns, SettingsSection } from "@/components/settings/settings-ui";
import { PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getEmailStatus } from "@/features/notifications/email-settings";
import { getComingUp, getPushSetup, listRecentNotifications } from "@/features/notifications/queries";

export const metadata: Metadata = { title: "Notifications" };

async function ComingUp() {
  const { today, days, failedSources } = await getComingUp();
  return (
    <SettingsSection
      label="Coming up"
      note={failedSources.length > 0 ? `Could not read ${failedSources.join(", ")}; what they would send is missing.` : "If nothing is paid, renewed or added in the meantime."}
    >
      <ComingUpLine days={days} today={today} />
    </SettingsSection>
  );
}

async function Channels() {
  const [{ configured, switchedOn }, email] = await Promise.all([getPushSetup(), getEmailStatus()]);
  return <ChannelRows email={<EmailRow status={email} />} push={{ configured, switchedOn }} />;
}

/** Left out while push is not set up on the server: the iPhone row above already says so. Its heading names the device. */
async function Device() {
  const setup = await getPushSetup();
  return setup.configured ? <ThisDevice setup={setup} /> : null;
}

async function Recent() {
  return <RecentList rows={await listRecentNotifications(20)} />;
}

/**
 * Settings › Notifications (N.1, DECISIONS C139; N.2, C141; N.3, C140; board HSettingsMore). The hub
 * writes only when something is new: a plan-ahead email, an act-now iPhone push, one push on the first
 * day overdue. Each channel's row has its switch; until it is set up and switched on, the daily run logs
 * what it would send ("not sent"). iPhone push is also turned on per device under "This iPhone".
 * Owner only: the page checks it itself (OwnerOnly) and so do its queries, as well as the Settings layout.
 */
export default function NotificationsPage() {
  // Owner only on its own, not just through the Settings layout (a partial request can skip it).
  return (
    <OwnerOnly>
      <>
        <PageHeader title="Notifications" parent={{ href: "/settings", label: "Settings" }} />

        <SettingsColumns>
          <SettingsColumn>
            <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
              <ComingUp />
            </Suspense>
          </SettingsColumn>

          <SettingsColumn>
            <SettingsSection label="Where to tell you">
              <Suspense fallback={<Skeleton className="h-28 rounded-2xl" />}>
                <Channels />
              </Suspense>
            </SettingsSection>

            <Suspense fallback={<Skeleton className="h-36 rounded-2xl" />}>
              <Device />
            </Suspense>

            <SettingsSection label="Recently sent">
              <Suspense fallback={<Skeleton className="h-40 rounded-2xl" />}>
                <Recent />
              </Suspense>
            </SettingsSection>
          </SettingsColumn>
        </SettingsColumns>
      </>
    </OwnerOnly>
  );
}
