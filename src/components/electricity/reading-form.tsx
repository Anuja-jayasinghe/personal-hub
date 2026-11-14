"use client";

import { useActionState, useEffect, useState } from "react";
import { labelClass, labelTextClass } from "@/components/shared/form-styles";
import { SubmitButton } from "@/components/shared/submit-button";
import { useKeepValuesOnError } from "@/components/shared/use-keep-values-on-error";
import { Input } from "@/components/ui/input";
import type { ElectricityReading } from "@/db/schema";
import { initialActionState, type ActionState } from "@/features/shared/types";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** Add: the meter the reading belongs to. */
  meterId?: string;
  /** Edit: the reading to change. */
  reading?: ElectricityReading;
  /** Add: pre-filled date ("YYYY-MM-DD"), usually today in the app time zone. */
  defaultDate?: string;
};

/** Add / edit form for a meter reading (addReading / updateReading). */
export function ReadingForm({ action, meterId, reading, defaultDate }: Props) {
  const [state, formAction] = useActionState(action, initialActionState);
  const { formRef, onSubmit } = useKeepValuesOnError(state);
  const [replaced, setReplaced] = useState(reading?.replacedFinalValue != null);

  useEffect(() => {
    if (state.ok && !reading) {
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the toggle together with the form
      setReplaced(false);
    }
  }, [formRef, state, reading]);

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="flex flex-col gap-3">
      {reading ? <input type="hidden" name="id" value={reading.id} /> : <input type="hidden" name="meterId" value={meterId} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          <span className={labelTextClass}>Reading date</span>
          <Input type="date" name="readingDate" required defaultValue={reading?.readingDate ?? defaultDate} />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>{replaced ? "New meter's starting reading (kWh)" : "Meter reading (kWh)"}</span>
          <Input name="value" required inputMode="decimal" defaultValue={reading?.value ?? ""} placeholder="12345.6" />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="replaced"
          checked={replaced}
          onChange={(e) => setReplaced(e.target.checked)}
          className="size-4"
        />
        Meter replaced (the meter was swapped for a new one)
      </label>
      {replaced ? (
        <label className={labelClass}>
          <span className={labelTextClass}>Old meter&apos;s final reading (kWh)</span>
          <Input name="replacedFinalValue" required inputMode="decimal" defaultValue={reading?.replacedFinalValue ?? ""} className="max-w-48" />
        </label>
      ) : null}

      <label className={labelClass}>
        <span className={labelTextClass}>Note (optional)</span>
        <Input name="note" maxLength={500} defaultValue={reading?.note ?? ""} />
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div>
        <SubmitButton pendingLabel="Saving…">{reading ? "Save changes" : "Add reading"}</SubmitButton>
      </div>
    </form>
  );
}
