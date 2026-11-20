import type { Metadata } from "next";
import { Suspense } from "react";
import { SlabRulesForm } from "@/components/settings/rules-forms";
import { LiveNow, MeterList, RuleInWords } from "@/components/settings/settings-sections";
import { SettingsColumn, SettingsColumns, SettingsSection } from "@/components/settings/settings-ui";
import { PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { currentLive } from "@/features/electricity/live";
import { listLiveSwitches, listMeters } from "@/features/electricity/queries";
import { getRules } from "@/features/settings/queries";
import { todayInAppTz } from "@/lib/format";

export const metadata: Metadata = { title: "Meters and rules" };

async function Meters() {
  const [active, archived, switches] = await Promise.all([listMeters(false), listMeters(true), listLiveSwitches()]);
  const live = currentLive(switches, active.map((m) => m.id));
  return (
    <>
      <MeterList meters={active} archived={archived} />
      {active.length > 1 ? (
        <div className="mt-3.5 flex flex-col gap-2.5">
          <h2 className="font-mono text-[10.5px] tracking-[0.14em] text-label uppercase">Which meter is live now</h2>
          <LiveNow meters={active.map((m) => ({ id: m.id, name: m.name }))} live={live} today={todayInAppTz()} />
        </div>
      ) : null}
    </>
  );
}

async function Rules() {
  const rules = await getRules();
  return (
    <>
      <SettingsSection label="The slab rule" note="The pace, the warnings, the meter checks and the reminders all follow these numbers.">
        <SlabRulesForm rules={rules} />
      </SettingsSection>
      <SettingsSection label="How it works">
        <RuleInWords rules={rules} />
      </SettingsSection>
    </>
  );
}

/**
 * Settings › Meters and rules (R.6, board HSettingsMore; S.2a, C106): the meters are added, edited,
 * archived and deleted here, which meter is live is switched here only, and the rule's numbers are
 * changed here (S.2b, C107).
 */
export default function MetersAndRulesPage() {
  return (
    <>
      <PageHeader title="Meters and rules" parent={{ href: "/settings", label: "Settings" }} />

      <SettingsColumns>
        <SettingsColumn>
          <SettingsSection label="Meters">
            <Suspense fallback={<Skeleton className="h-28 rounded-2xl" />}>
              <Meters />
            </Suspense>
          </SettingsSection>
        </SettingsColumn>

        <SettingsColumn>
          <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
            <Rules />
          </Suspense>
        </SettingsColumn>
      </SettingsColumns>
    </>
  );
}
