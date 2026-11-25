"use client";

import { useActionState, useEffect } from "react";
import { labelClass, labelTextClass } from "@/components/shared/form-styles";
import { SubmitButton } from "@/components/shared/submit-button";
import { useKeepValuesOnError } from "@/components/shared/use-keep-values-on-error";
import { Input } from "@/components/ui/input";
import type { VehicleOdometerReading } from "@/db/schema";
import { initialActionState, type ActionState } from "@/features/shared/types";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** Add: the vehicle the reading belongs to. */
  vehicleId?: string;
  /** Edit: the reading to change. */
  reading?: VehicleOdometerReading;
  /** Add: pre-filled date, usually today in the app time zone. */
  defaultDate?: string;
};

/** Add / edit form for a dated odometer reading (addOdometerReading / updateOdometerReading). */
export function OdometerForm({ action, vehicleId, reading, defaultDate, onDone }: Props & { onDone?: () => void }) {
  const [state, formAction] = useActionState(action, initialActionState);
  const { formRef, onSubmit } = useKeepValuesOnError(state);

  useEffect(() => {
    if (!state.ok) return;
    if (!reading) formRef.current?.reset();
    onDone?.();
  }, [formRef, state, reading, onDone]);

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="flex flex-col gap-3">
      {reading ? <input type="hidden" name="id" value={reading.id} /> : <input type="hidden" name="vehicleId" value={vehicleId} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelClass}>
          <span className={labelTextClass}>Date it was read</span>
          <Input type="date" name="readingDate" required defaultValue={reading?.readingDate ?? defaultDate} />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Odometer (km)</span>
          <Input name="km" enterKeyHint="next" required inputMode="numeric" defaultValue={reading?.km ?? ""} placeholder="84000" />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Note (optional)</span>
          <Input name="note" enterKeyHint="done" maxLength={200} defaultValue={reading?.note ?? ""} placeholder="e.g. when I bought it" />
        </label>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {reading ? (
        <div>
          <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        </div>
      ) : (
        <SubmitButton pendingLabel="Saving…" size="lg" className="w-full">
          Save reading
        </SubmitButton>
      )}
    </form>
  );
}
