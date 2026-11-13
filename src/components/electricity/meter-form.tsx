"use client";

import { useActionState, useEffect, useRef } from "react";
import { labelClass, labelTextClass, textareaClass } from "@/components/shared/form-styles";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import type { ElectricityMeter } from "@/db/schema";
import { initialActionState, type ActionState } from "@/features/shared/types";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** Pass an existing meter to edit it. */
  meter?: ElectricityMeter;
};

/** Add / edit form for a meter (createMeter / updateMeter). */
export function MeterForm({ action, meter }: Props) {
  const [state, formAction] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && !meter) formRef.current?.reset();
  }, [state, meter]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {meter ? <input type="hidden" name="id" value={meter.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          <span className={labelTextClass}>Name</span>
          <Input name="name" required maxLength={60} defaultValue={meter?.name} placeholder="e.g. Main house" />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Account number (optional)</span>
          <Input name="accountNumber" maxLength={40} defaultValue={meter?.accountNumber ?? ""} />
        </label>
      </div>
      <label className={labelClass}>
        <span className={labelTextClass}>Notes (optional)</span>
        <textarea name="notes" maxLength={500} defaultValue={meter?.notes ?? ""} className={textareaClass} />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div>
        <SubmitButton pendingLabel="Saving…">{meter ? "Save changes" : "Add meter"}</SubmitButton>
      </div>
    </form>
  );
}
