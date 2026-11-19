"use client";

import { useActionState, useEffect } from "react";
import { labelClass, labelTextClass } from "@/components/shared/form-styles";
import { SubmitButton } from "@/components/shared/submit-button";
import { useKeepValuesOnError } from "@/components/shared/use-keep-values-on-error";
import { Input } from "@/components/ui/input";
import type { ElectricityBill } from "@/db/schema";
import { initialActionState, type ActionState } from "@/features/shared/types";
import { formatDate } from "@/lib/format";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** Add: the meter the bill belongs to. */
  meterId?: string;
  /** Edit: the bill to change. */
  bill?: ElectricityBill;
  /** Add: pre-filled bill date, usually today in the app time zone. */
  defaultDate?: string;
  /** Add: pre-filled previous reading, the current reading of the meter's last bill. */
  defaultPrevious?: string;
  /** Add: the reading date of that last bill, shown next to the auto-filled previous reading. */
  previousDate?: string;
  /** Called after a successful save, e.g. to close the card the form sits in. */
  onDone?: () => void;
};

/** Add / edit form for a bill (createBill / updateBill). Units are worked out from the readings when left empty. */
export function BillForm({ action, meterId, bill, defaultDate, defaultPrevious, previousDate, onDone }: Props) {
  // C73: once a meter has a bill, the previous reading is taken from it, so only this month's reading is typed.
  const autoPrevious = !bill && defaultPrevious !== undefined;
  const [state, formAction] = useActionState(action, initialActionState);
  const { formRef, onSubmit } = useKeepValuesOnError(state);

  useEffect(() => {
    if (!state.ok) return;
    if (!bill) formRef.current?.reset();
    onDone?.();
  }, [formRef, state, bill, onDone]);

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="flex flex-col gap-3">
      {bill ? <input type="hidden" name="id" value={bill.id} /> : <input type="hidden" name="meterId" value={meterId} />}

      <div className="grid gap-3 @sm:grid-cols-2">
        <label className={labelClass}>
          <span className={labelTextClass}>Bill date</span>
          <Input type="date" name="billDate" required defaultValue={bill?.billDate ?? defaultDate} />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Reading date (optional, defaults to the bill date)</span>
          <Input type="date" name="readingDate" defaultValue={bill?.readingDate ?? ""} />
        </label>
      </div>

      {autoPrevious ? (
        <details className="rounded-md border px-3 py-2 text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            Previous reading {defaultPrevious} kWh, from the last bill{previousDate ? ` (${formatDate(previousDate)})` : ""}. Change
          </summary>
          <label className={`${labelClass} mt-2 max-w-xs`}>
            <span className={labelTextClass}>Previous reading (kWh)</span>
            <Input name="previousReading" required inputMode="decimal" defaultValue={defaultPrevious} />
          </label>
        </details>
      ) : null}

      <div className="grid gap-3 @sm:grid-cols-2 @lg:grid-cols-3">
        {autoPrevious ? null : (
          <label className={labelClass}>
            <span className={labelTextClass}>{bill ? "Previous reading (kWh)" : "Previous reading (kWh), needed once for the first bill"}</span>
            <Input name="previousReading" required inputMode="decimal" defaultValue={bill?.previousReading ?? ""} placeholder="12345.6" />
          </label>
        )}
        <label className={labelClass}>
          <span className={labelTextClass}>Current reading (kWh)</span>
          <Input name="currentReading" required inputMode="decimal" defaultValue={bill?.currentReading ?? ""} placeholder="12560" />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Units (optional)</span>
          <Input name="units" inputMode="decimal" defaultValue={bill?.units ?? ""} placeholder="current − previous" />
        </label>
      </div>

      <div className="grid gap-3 @sm:grid-cols-2 @lg:grid-cols-3">
        <label className={labelClass}>
          <span className={labelTextClass}>Amount (optional)</span>
          <Input name="amount" inputMode="decimal" defaultValue={bill?.amount ?? ""} placeholder="0.00" />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Due date (optional)</span>
          <Input type="date" name="dueDate" defaultValue={bill?.dueDate ?? ""} />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Paid on (optional)</span>
          <Input type="date" name="paidDate" defaultValue={bill?.paidDate ?? ""} />
        </label>
      </div>

      <label className={labelClass}>
        <span className={labelTextClass}>Notes (optional)</span>
        <Input name="notes" maxLength={500} defaultValue={bill?.notes ?? ""} />
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      {bill ? (
        <div>
          <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        </div>
      ) : (
        <SubmitButton pendingLabel="Saving…" size="lg" className="w-full">
          Save the bill
        </SubmitButton>
      )}
    </form>
  );
}
