"use client";

import { useActionState, useEffect, useState } from "react";
import { labelClass, labelTextClass, selectClass } from "@/components/shared/form-styles";
import { SubmitButton } from "@/components/shared/submit-button";
import { useKeepValuesOnError } from "@/components/shared/use-keep-values-on-error";
import { Input } from "@/components/ui/input";
import type { VehicleRenewal } from "@/db/schema";
import { carriesOdometer } from "@/features/vehicles/renewal-validate";
import { initialActionState, type ActionState } from "@/features/shared/types";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  types: readonly string[];
  /** The record to change (edit) or the record being renewed (renew; its type is kept). */
  renewal?: VehicleRenewal;
  /** A new renewal is added with the one flow for papers (V.1b); this form only edits and renews. */
  mode: "edit" | "renew";
  /** Called after a successful save, e.g. to close the sheet the form sits in. */
  /** False when the vehicle's emission certificates print an inaccurate odometer (issue #184). */
  askOdometer?: boolean;
  onDone?: () => void;
};

/** One form for editing and renewing a renewal (updateRenewal / renewRenewal). */
export function RenewalForm({ action, types, renewal, mode, askOdometer = true, onDone }: Props) {
  const [state, formAction] = useActionState(action, initialActionState);
  const { formRef, onSubmit } = useKeepValuesOnError(state);

  useEffect(() => {
    if (!state.ok) return;
    onDone?.();
  }, [state, onDone]);

  const renewing = mode === "renew";
  // An emission test's certificate prints the odometer on the test day (issue #181).
  const [type, setType] = useState(renewal?.type ?? "");
  // When renewing, the new cover normally starts where the old one ends.
  const defaults = {
    provider: renewal?.provider ?? "",
    startDate: renewing ? (renewal?.expiryDate ?? "") : (renewal?.startDate ?? ""),
    expiryDate: renewing ? "" : (renewal?.expiryDate ?? ""),
    amount: renewing ? "" : (renewal?.amount ?? ""),
    odometerKm: renewing ? "" : (renewal?.odometerKm?.toString() ?? ""),
  };

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={renewal?.id} />

      {mode === "edit" ? (
        <label className={labelClass}>
          <span className={labelTextClass}>Type</span>
          <select name="type" required defaultValue={renewal?.type} onChange={(e) => setType(e.target.value)} className={selectClass}>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-sm text-muted-foreground">
          Renewing <span className="font-medium text-foreground">{renewal?.type}</span>. The old record is kept as history.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          <span className={labelTextClass}>Provider (optional)</span>
          <Input name="provider" maxLength={100} defaultValue={defaults.provider} />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelClass}>
          <span className={labelTextClass}>Start date (optional)</span>
          <Input type="date" name="startDate" defaultValue={defaults.startDate} />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>{renewing ? "New expiry date" : "Expiry date"}</span>
          <Input type="date" name="expiryDate" required defaultValue={defaults.expiryDate} />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Amount (optional)</span>
          <Input name="amount" inputMode="decimal" defaultValue={defaults.amount} placeholder="0.00" />
        </label>
      </div>

      {askOdometer && carriesOdometer(type) ? (
        <label className={`${labelClass} sm:max-w-[calc(33%-0.5rem)]`}>
          <span className={labelTextClass}>Odometer on the test day (optional)</span>
          <Input name="odometerKm" inputMode="numeric" defaultValue={defaults.odometerKm} placeholder="42959" />
          <span className="text-xs text-muted-foreground">Printed on the certificate. The start date is the test day.</span>
        </label>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div>
        <SubmitButton pendingLabel="Saving…">{renewing ? "Renewed" : "Save changes"}</SubmitButton>
      </div>
    </form>
  );
}
