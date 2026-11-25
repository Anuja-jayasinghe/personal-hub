"use client";

import { useActionState, useEffect, useState } from "react";
import { MeterBadge } from "@/components/electricity/meter-tone";
import { labelTextClass } from "@/components/shared/form-styles";
import { SubmitButton } from "@/components/shared/submit-button";
import { useKeepValuesOnError } from "@/components/shared/use-keep-values-on-error";
import { Input } from "@/components/ui/input";
import { addReadings } from "@/features/electricity/actions";
import { previewReading } from "@/features/electricity/readings-batch";
import { formatKwh } from "@/features/electricity/usage";
import { initialActionState } from "@/features/shared/types";
import { dayMonthIn } from "@/lib/dates";

export type MeterForEntry = {
  id: string;
  name: string;
  toneIndex: number;
  /** The meter's newest reading in hundredths of a kWh, if it has one. */
  lastValue: number | null;
  /** "YYYY-MM-DD" of that reading. */
  lastDate: string | null;
};

/**
 * Both meters' readings in one step (2b.1, C83): one big field per meter, then the date (today by default, below the readings so the cursor starts on the first meter). Under each field
 * it says what the last reading was and, as you type, how much the meter has gone up since, or that
 * the figure is lower than the last reading. A blank field skips that meter.
 */
export function BothReadingsForm({ meters, defaultDate, onDone }: { meters: MeterForEntry[]; defaultDate: string; onDone?: () => void }) {
  const [state, formAction] = useActionState(addReadings, initialActionState);
  const { formRef, onSubmit } = useKeepValuesOnError(state);
  const [typed, setTyped] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear the live previews together with the form
    setTyped({});
    onDone?.();
  }, [formRef, state, onDone]);

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="flex flex-col gap-4">
      {meters.map((m) => {
        const preview = previewReading(m.lastValue, typed[m.id] ?? "");
        const hintId = `reading-hint-${m.id}`;
        return (
          <div key={m.id} className="flex flex-col gap-2 rounded-2xl bg-background p-3.5 ring-1 ring-border has-[[aria-invalid=true]]:ring-destructive">
            <label htmlFor={`reading-${m.id}`} className="flex items-center gap-2 text-sm font-medium">
              <MeterBadge name={m.name} />
              {m.name}
              {m.lastValue !== null && m.lastDate ? (
                <span className="ml-auto font-mono text-[11px] font-normal text-label">
                  last {formatKwh(m.lastValue)} · {dayMonthIn(m.lastDate, defaultDate)}
                </span>
              ) : null}
            </label>
            <Input
              id={`reading-${m.id}`}
              name={`value:${m.id}`}
              inputMode="decimal"
              enterKeyHint="next"
              autoComplete="off"
              placeholder={m.lastValue !== null ? formatKwh(m.lastValue).replace(" kWh", "") : "Reading"}
              aria-describedby={hintId}
              aria-invalid={preview.state === "lower" || preview.state === "invalid" ? true : undefined}
              onChange={(e) => setTyped((t) => ({ ...t, [m.id]: e.target.value }))}
              className="h-14 font-mono text-2xl font-semibold tracking-[0.12em] tabular-nums"
            />
            <p id={hintId} aria-live="polite" className="min-h-5 text-[13px] font-medium">
              {preview.state === "ok" && preview.delta !== null ? (
                <span className="text-status-ok">+{formatKwh(preview.delta)} since the last reading</span>
              ) : null}
              {preview.state === "lower" ? (
                <span className="text-destructive">Lower than the last reading ({formatKwh(preview.last)}). Check the number.</span>
              ) : null}
              {preview.state === "invalid" ? <span className="text-destructive">Enter a number like 17489 or 17489.5.</span> : null}
              {preview.state === "empty" ? <span className="font-normal text-muted-foreground">Leave empty to skip this meter.</span> : null}
            </p>
          </div>
        );
      })}

      <label className="flex flex-col gap-1 text-sm">
        <span className={labelTextClass}>Reading date (today unless you change it)</span>
        <Input type="date" name="readingDate" required defaultValue={defaultDate} className="h-11 max-w-48" />
      </label>

      {state.error ? (
        <p role="alert" className="whitespace-pre-line text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <SubmitButton pendingLabel="Saving…" size="lg" className="w-full">
        Save readings
      </SubmitButton>
    </form>
  );
}
