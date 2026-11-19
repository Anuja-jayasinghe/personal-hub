import Link from "next/link";
import { Trash2 } from "lucide-react";
import { LiveControls } from "@/components/electricity/live-switch";
import { MeterForm } from "@/components/electricity/meter-form";
import { MeterBadge } from "@/components/electricity/meter-tone";
import { RowCard, Row, RowMeta, RuleValue } from "@/components/settings/settings-ui";
import { SubmitButton } from "@/components/shared/submit-button";
import { getIcon } from "@/components/shell/icons";
import { appConfig } from "@/config/app.config";
import type { ElectricityMeter } from "@/db/schema";
import { archiveMeter, createMeter, deleteMeter, unarchiveMeter, updateMeter } from "@/features/electricity/actions";
import { liveForText, type LiveMeter } from "@/features/electricity/live";
import { formatDate } from "@/lib/format";

/**
 * The sections of the Settings pages (R.6; boards HSettings, HSettingsMore). Display only: the pages
 * read the data and pass it in. Everything here comes from app.config.ts or from the props.
 */

const CONFIG_FILE = <code className="font-mono text-[11.5px]">src/config/app.config.ts</code>;
export const configFileNote = (lead: string) => (
  <>
    {lead} {CONFIG_FILE}.
  </>
);

/** The parts of the hub and their icons (built once, outside render). */
const PARTS = [
  ...appConfig.modules.map((m) => ({ key: m.key, name: m.label, Icon: getIcon(m.icon), on: m.enabled })),
  ...appConfig.sharedPages.map((p) => ({ key: p.key, name: p.label, Icon: getIcon(p.icon), on: true })),
];

export function PartsList() {
  return (
    <RowCard>
      {PARTS.map(({ key, name, Icon, on }) => (
        <Row
          key={key}
          label={name}
          icon={
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-raised/70 text-muted-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]">
              <Icon className="size-[18px]" />
            </span>
          }
          end={<RowMeta tone={on ? "ok" : "quiet"}>{on ? "On" : "Off"}</RowMeta>}
        />
      ))}
    </RowCard>
  );
}

/** The three numbers of the slab rule as tiles, linking to Meters and rules. */
export function SlabRuleTiles() {
  const { lowUnits, highUnits, nearUnits } = appConfig.electricity.limits;
  const tiles = [
    [lowUnits, "low slab, units"],
    [highUnits, "high slab, units"],
    [nearUnits, "warn this close"],
  ] as const;
  return (
    <Link
      href="/settings/meters"
      className="grid grid-cols-3 gap-2.5 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`The slab rule: low slab ${lowUnits} units, high slab ${highUnits} units, warn ${nearUnits} units before. Open Meters and rules.`}
    >
      {tiles.map(([value, label]) => (
        <span key={label} className="flex flex-col gap-1.5 rounded-2xl border bg-card p-3.5 hover:border-primary/50">
          <span className="font-display text-3xl leading-none font-semibold tabular-nums">{value}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </span>
      ))}
    </Link>
  );
}

/** Currency, time zone and reminder lead times. */
export function HubFacts() {
  const leadDays = appConfig.reminders.leadDays.map((d) => (d === 0 ? "on the day" : `${d}`)).join(", ");
  return (
    <RowCard>
      <Row label="Currency" end={<RowMeta>{appConfig.currency.code}</RowMeta>} />
      <Row label="Time zone" end={<RowMeta>{appConfig.timeZone}</RowMeta>} />
      <Row label="Reminders" hint={`days before something is due: ${leadDays}`} />
    </RowCard>
  );
}

/** The sub-pages as rows (phone; desktop has the sub-menu), with what each holds on the right. */
export function SubPageList({ meters, backup }: { meters?: string; backup?: string }) {
  return (
    <RowCard>
      <Row label="Meters and rules" hint="your meters, 120 / 180, read every few days" end={meters ? <RowMeta>{meters}</RowMeta> : null} href="/settings/meters" />
      <Row label="Data and backup" hint="backups, exports, files stored" end={backup ? <RowMeta>{backup}</RowMeta> : null} href="/settings/backup" />
    </RowCard>
  );
}

/** Last four characters of an account number, so the full number is not on screen. */
export function accountTail(account: string | null): string {
  if (!account) return "No account number";
  const clean = account.replace(/\s+/g, "");
  return clean.length > 4 ? `Account …${clean.slice(-4)}` : `Account ${clean}`;
}

type ManagedMeter = Pick<ElectricityMeter, "id" | "name" | "accountNumber" | "notes" | "archivedAt" | "createdAt" | "updatedAt">;

/** One meter as a row that opens its actions (edit, archive, delete), tucked away because they are rare (S.2a). */
function MeterRow({ meter }: { meter: ManagedMeter }) {
  const active = !meter.archivedAt;
  return (
    <details className="group/m">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <MeterBadge name={meter.name} className="h-7 min-w-8 text-[13px]" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-3">
          <span className="text-[15px] font-semibold">{meter.name}</span>
          <span className="font-mono text-[11px] tracking-[0.1em] text-muted-foreground uppercase">{accountTail(meter.accountNumber)}</span>
        </span>
        <span className="text-sm font-medium text-primary group-open/m:hidden">Manage</span>
        <span className="hidden text-sm font-medium text-muted-foreground group-open/m:inline">Close</span>
      </summary>
      <div className="flex flex-col gap-3 pb-4">
        {active ? <MeterForm action={updateMeter} meter={meter as ElectricityMeter} /> : null}
        <div className="flex flex-wrap gap-2">
          <form action={active ? archiveMeter : unarchiveMeter}>
            <input type="hidden" name="id" value={meter.id} />
            <SubmitButton variant="outline" size="sm" confirm={active ? `Archive "${meter.name}"? Its readings and bills are kept.` : undefined}>
              {active ? "Archive meter" : "Bring back"}
            </SubmitButton>
          </form>
          <form action={deleteMeter}>
            <input type="hidden" name="id" value={meter.id} />
            <SubmitButton variant="ghost" size="sm" confirm={`Permanently delete "${meter.name}" and all its readings and bills? This cannot be undone.`}>
              <Trash2 aria-hidden /> Delete meter
            </SubmitButton>
          </form>
        </div>
      </div>
    </details>
  );
}

/**
 * The meters on Meters and rules (S.2a, C106): everything about a meter is set up here, with no trip to
 * Electricity. Each meter row opens its actions (edit, archive, delete); "Add a meter" and the archived meters
 * are tucked below, since they are rare.
 */
export function MeterList({ meters, archived }: { meters: ManagedMeter[]; archived: ManagedMeter[] }) {
  return (
    <div className="flex flex-col gap-3">
      {meters.length > 0 ? (
        <RowCard>
          {meters.map((m) => (
            <MeterRow key={m.id} meter={m} />
          ))}
        </RowCard>
      ) : (
        <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">No meters yet. Add the first one below.</p>
      )}

      <details className="rounded-2xl border bg-card" open={meters.length === 0}>
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Add a meter</summary>
        <div className="border-t p-4">
          <MeterForm action={createMeter} />
        </div>
      </details>

      {archived.length > 0 ? (
        <details className="rounded-2xl border bg-card">
          <summary className="cursor-pointer px-4 py-3 text-sm text-muted-foreground">Archived meters ({archived.length})</summary>
          <div className="flex flex-col divide-y divide-raised border-t px-4">
            {archived.map((m) => (
              <MeterRow key={m.id} meter={m} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

/** The slab rule's numbers, read-only, with what each one does. */
export function RuleRows() {
  const { limits, checkEveryDays, billingCycleDays } = appConfig.electricity;
  const rules = [
    { label: "Low slab", hint: "one meter stays at or under this", value: limits.lowUnits, unit: "units" },
    { label: "High slab", hint: "the other stays at or under this", value: limits.highUnits, unit: "units" },
    { label: "Warn when this close", hint: "units left before a slab", value: limits.nearUnits, unit: "units" },
    { label: "Read each meter every", hint: "drives the meter check on Home and Reminders", value: checkEveryDays, unit: "days" },
    { label: "Billing cycle", hint: "days between bills, for the pace", value: billingCycleDays, unit: "days" },
  ];
  return (
    <RowCard>
      {rules.map((r) => (
        <Row key={r.label} label={r.label} hint={r.hint} end={<RuleValue value={r.value} unit={r.unit} />} />
      ))}
    </RowCard>
  );
}

/** The rule in words. */
export function RuleInWords() {
  const { limits } = appConfig.electricity;
  return (
    <p className="rounded-2xl border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
      In each billing cycle one meter stays at <span className="font-semibold text-foreground">{limits.lowUnits}</span> units or under and the other may run
      up to <span className="font-semibold text-foreground">{limits.highUnits}</span>. The first meter to pass {limits.lowUnits} becomes the high one. A meter
      counts as near its limit with {limits.nearUnits} units or fewer left.
    </p>
  );
}

/** "Which meter is live now" (issue #69, board HSettingsMore): the meter carrying the house, since when, and the switch. */
export function LiveNow({ meters, live, today }: { meters: { id: string; name: string }[]; live: LiveMeter | null; today: string }) {
  const current = live ? meters.find((m) => m.id === live.meterId) : undefined;
  if (meters.length < 2) return null;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      {current && live ? (
        <p className="flex items-center gap-3">
          <MeterBadge name={current.name} className="h-7 min-w-8 text-[13px]" />
          <span className="flex flex-col">
            <span className="text-[15px] font-semibold">{current.name} is live</span>
            <span className="text-[12.5px] text-muted-foreground">
              {liveForText(live.since, today)} · switched on {formatDate(live.since)}
            </span>
          </span>
        </p>
      ) : null}
      <LiveControls meters={meters} live={live} today={today} framed={false} showStatus={false} />
      <p className="text-xs text-muted-foreground">Switching asks first and keeps the history, so the pace stays right.</p>
    </div>
  );
}
