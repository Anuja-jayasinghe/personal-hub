"use client";

import { Minus, Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/shared/submit-button";
import { initialActionState } from "@/features/shared/types";
import { saveOilRules, saveReminderDays, saveSlabRules } from "@/features/settings/actions";
import { LEAD_DAY_CHOICES, OIL_LIMITS, RULE_LIMITS, type HubRules } from "@/features/settings/rules";

function Saved({ state }: { state: { ok: boolean; error?: string } }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-status-overdue">
        {state.error}
      </p>
    );
  }
  return state.ok ? (
    <p role="status" className="text-sm text-status-ok">
      Saved. Every page uses the new numbers now.
    </p>
  ) : null;
}

/** −, the number in Oxanium, + (DESIGN.md "Steppers"); also typeable. Sends its value under `name`. */
function Stepper({
  name,
  label,
  hint,
  unit,
  initial,
  step: size = 1,
}: {
  name: keyof typeof RULE_LIMITS | keyof typeof OIL_LIMITS;
  label: string;
  hint: string;
  unit: string;
  initial: number;
  /** How much one tap of − or + changes the number. */
  step?: number;
}) {
  const { min, max } = name in RULE_LIMITS ? RULE_LIMITS[name as keyof typeof RULE_LIMITS] : OIL_LIMITS[name as keyof typeof OIL_LIMITS];
  const [value, setValue] = useState(String(initial));
  const n = Number(value);
  const step = (d: number) => setValue(String(Math.min(max, Math.max(min, (Number.isFinite(n) ? n : initial) + d * size))));
  const btn =
    "flex size-11 items-center justify-center rounded-lg border bg-background text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";
  return (
    <div className="flex min-h-16 flex-wrap items-center gap-3 py-2">
      <label htmlFor={`rule-${name}`} className="flex min-w-44 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{label}</span>
        <span className="text-[12.5px] text-muted-foreground">{hint}</span>
      </label>
      <div className="flex items-center gap-1.5">
        <button type="button" className={btn} onClick={() => step(-1)} disabled={n <= min} aria-label={`${label}: one less`}>
          <Minus className="size-4" aria-hidden />
        </button>
        <input
          id={`rule-${name}`}
          name={name}
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
          className="h-11 w-16 rounded-lg border bg-background text-center font-display text-xl font-semibold tabular-nums outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
        />
        <button type="button" className={btn} onClick={() => step(1)} disabled={n >= max} aria-label={`${label}: one more`}>
          <Plus className="size-4" aria-hidden />
        </button>
        <span className="w-10 font-mono text-[10px] tracking-[0.12em] text-label uppercase">{unit}</span>
      </div>
    </div>
  );
}

/** The slab rule and the meter rhythm, editable (S.2b, C107; board HSettingsMore). */
export function SlabRulesForm({ rules }: { rules: HubRules }) {
  const [state, action] = useActionState(saveSlabRules, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col divide-y divide-raised rounded-2xl border bg-card px-4">
        <Stepper name="lowUnits" label="Low slab" hint="one meter stays at or under this" unit="units" initial={rules.lowUnits} />
        <Stepper name="highUnits" label="High slab" hint="the other may run up to this" unit="units" initial={rules.highUnits} />
        <Stepper name="nearUnits" label="Warn when this close" hint="units left before a slab" unit="units" initial={rules.nearUnits} />
        <Stepper name="checkEveryDays" label="Read each meter every" hint="when Home and Reminders ask for a reading" unit="days" initial={rules.checkEveryDays} />
        <Stepper name="billingCycleDays" label="Billing cycle" hint="days between bills, for the pace" unit="days" initial={rules.billingCycleDays} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Save the rules</SubmitButton>
        <Saved state={state} />
      </div>
    </form>
  );
}

/**
 * The oil-change marker (V.1a, C147): how many months after an oil-change service the next one is due, the km
 * shown beside that date (a glance only, nothing reminds by km, C24), and which service types count. Rarely
 * changed, so it is tucked under one quiet row instead of always open.
 */
export function OilChangeForm({ rules }: { rules: HubRules }) {
  const [state, action] = useActionState(saveOilRules, initialActionState);
  return (
    <details className="group/oil rounded-2xl border bg-card px-4">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-3">
          <span className="text-[15px] font-semibold">Next oil change</span>
          <span className="text-[12.5px] text-muted-foreground">
            {rules.oilChangeMonths} {rules.oilChangeMonths === 1 ? "month" : "months"} or {rules.oilChangeKm.toLocaleString("en-US")} km after {rules.oilChangeTypes.join(", ").toLowerCase()}
          </span>
        </span>
        <span className="text-sm font-medium text-primary group-open/oil:hidden">Change</span>
        <span className="hidden text-sm font-medium text-muted-foreground group-open/oil:inline">Close</span>
      </summary>
      <form action={action} className="flex flex-col gap-3 pb-4">
        <div className="flex flex-col divide-y divide-raised">
          <Stepper name="oilChangeMonths" label="Due after" hint="the reminder date, from the service date" unit="months" initial={rules.oilChangeMonths} />
          <Stepper name="oilChangeKm" label="Or after" hint="shown beside the date; nothing reminds by km" unit="km" initial={rules.oilChangeKm} step={500} />
        </div>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold">Services that set it</span>
          <input
            name="oilChangeTypes"
            defaultValue={rules.oilChangeTypes.join(", ")}
            maxLength={400}
            className="h-11 rounded-lg border bg-background px-3 text-base outline-none focus-visible:border-primary md:text-sm focus-visible:ring-1 focus-visible:ring-primary"
          />
          <span className="text-xs text-muted-foreground">Service types, separated by commas. Capital letters and spaces do not matter.</span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pendingLabel="Saving…">Save the oil-change rule</SubmitButton>
          <Saved state={state} />
        </div>
      </form>
    </details>
  );
}

const dayLabel = (d: number) => (d === 0 ? "On the day" : d === 1 ? "1 day" : `${d} days`);

/** Which days before a due date things show up in Reminders and on Home (S.2b, owner's list item 40). */
export function ReminderDaysForm({ rules }: { rules: HubRules }) {
  const [state, action] = useActionState(saveReminderDays, initialActionState);
  const [picked, setPicked] = useState<number[]>(rules.leadDays);
  const toggle = (d: number) => setPicked((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));
  return (
    <form action={action} className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2.5 rounded-2xl border bg-card p-4">
        <legend className="sr-only">Remind me this many days before</legend>
        <p className="text-sm text-muted-foreground">Remind me this many days before something is due:</p>
        <div className="flex flex-wrap gap-2">
          {LEAD_DAY_CHOICES.map((d) => {
            const on = picked.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(d)}
                className={`hit-44 min-h-9 rounded-full border px-3.5 text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  on ? "border-primary/50 bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {dayLabel(d)}
              </button>
            );
          })}
        </div>
        {picked.map((d) => (
          <input key={d} type="hidden" name="leadDays" value={d} />
        ))}
        <p className="text-xs text-muted-foreground">Overdue things always stay until they are done. A renewal type can still have its own days.</p>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Saving…" disabled={picked.length === 0}>
          Save reminder days
        </SubmitButton>
        <Saved state={state} />
      </div>
    </form>
  );
}
