import type { Metadata } from "next";
import { Suspense } from "react";
import { ChannelRows, ComingUpLine, RecentList } from "@/components/settings/notifications";
import { SettingsColumn, SettingsColumns, SettingsSection } from "@/components/settings/settings-ui";
import { PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getComingUp, listRecentNotifications } from "@/features/notifications/queries";

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

async function Recent() {
  return <RecentList rows={await listRecentNotifications(20)} />;
}

/**
 * Settings › Notifications (N.1, DECISIONS C139; board HSettingsMore). The hub writes only when
 * something is new: a plan-ahead email, an act-now iPhone push, one push on the first day overdue.
 * Neither channel is built yet, so the daily run logs what it would send ("not sent") and sends nothing.
 * Owner only (the Settings layout checks it).
 */
export default function NotificationsPage() {
  return (
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
            <ChannelRows />
          </SettingsSection>

          <SettingsSection label="Recently sent">
            <Suspense fallback={<Skeleton className="h-40 rounded-2xl" />}>
              <Recent />
            </Suspense>
          </SettingsSection>
        </SettingsColumn>
      </SettingsColumns>
    </>
  );
}
