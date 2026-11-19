import type { Metadata } from "next";
import { Suspense } from "react";
import { configFileNote, MeterList, RuleInWords, RuleRows } from "@/components/settings/settings-sections";
import { SettingsSection } from "@/components/settings/settings-ui";
import { PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { listMeters } from "@/features/electricity/queries";

export const metadata: Metadata = { title: "Meters and rules" };

async function Meters() {
  const [active, archived] = await Promise.all([listMeters(false), listMeters(true)]);
  return <MeterList meters={active} archivedCount={archived.length} />;
}

/**
 * Settings › Meters and rules (R.6, board HSettingsMore). Read-only: the meters are added and edited on
 * the Electricity page, and the rule's numbers live in app.config.ts. Which meter is live is issue #69.
 */
export default function MetersAndRulesPage() {
  return (
    <>
      <PageHeader title="Meters and rules" parent={{ href: "/settings", label: "Settings" }} />

      <SettingsSection label="Meters" note="Add, rename or archive a meter on the Electricity page.">
        <Suspense fallback={<Skeleton className="h-28 rounded-2xl" />}>
          <Meters />
        </Suspense>
      </SettingsSection>

      <SettingsSection label="The slab rule" note={configFileNote("Read-only. The pace, the warnings and the reminders all follow these numbers, set in")}>
        <RuleRows />
      </SettingsSection>

      <SettingsSection label="How it works">
        <RuleInWords />
      </SettingsSection>
    </>
  );
}
