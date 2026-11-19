"use client";

import { useActionState, useEffect } from "react";
import { labelClass, labelTextClass, textareaClass } from "@/components/shared/form-styles";
import { SubmitButton } from "@/components/shared/submit-button";
import { useKeepValuesOnError } from "@/components/shared/use-keep-values-on-error";
import { Input } from "@/components/ui/input";
import type { BillItem } from "@/db/schema";
import { FREQUENCIES, FREQUENCY_LABELS } from "@/features/bills/schedule";
import { initialActionState, type ActionState } from "@/features/shared/types";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** Pass an existing item to edit it. */
  item?: BillItem;
  /** Add: pre-filled next due date, usually today in the app time zone. */
  defaultDate?: string;
  /** Called after a successful save, e.g. to close the sheet the form sits in. */
  onDone?: () => void;
};

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

/** Add / edit form for a bill or subscription (createBillItem / updateBillItem). */
export function BillItemForm({ action, item, defaultDate, onDone }: Props) {
  const [state, formAction] = useActionState(action, initialActionState);
  const { formRef, onSubmit } = useKeepValuesOnError(state);

  useEffect(() => {
    if (!state.ok) return;
    if (!item) formRef.current?.reset();
    onDone?.();
  }, [formRef, state, item, onDone]);

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="flex flex-col gap-3">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelClass}>
          <span className={labelTextClass}>Name</span>
          <Input name="name" required maxLength={80} defaultValue={item?.name} placeholder="e.g. Dialog fibre, Netflix" />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Type</span>
          <select name="kind" defaultValue={item?.kind ?? "bill"} className={selectClass}>
            <option value="bill">Bill</option>
            <option value="subscription">Subscription</option>
          </select>
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>How often</span>
          <select name="frequency" required defaultValue={item?.frequency ?? "monthly"} className={selectClass}>
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelClass}>
          <span className={labelTextClass}>Next due date</span>
          <Input type="date" name="nextDueDate" required defaultValue={item?.nextDueDate ?? defaultDate} />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Usual amount (optional, LKR)</span>
          <Input name="amount" inputMode="decimal" defaultValue={item?.amount ?? ""} placeholder="0.00" />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Paid with (optional label)</span>
          <Input name="paymentMethod" maxLength={60} defaultValue={item?.paymentMethod ?? ""} placeholder="e.g. Visa, Sampath" />
        </label>
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">Write a label only. Card numbers are never stored, and the app refuses anything that looks like one.</p>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="autopay" defaultChecked={item?.autopay ?? false} className="size-4" />
        Paid automatically (autopay)
      </label>

      <label className={labelClass}>
        <span className={labelTextClass}>Notes (optional)</span>
        <textarea name="notes" maxLength={500} defaultValue={item?.notes ?? ""} className={textareaClass} />
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {item ? (
        <div>
          <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        </div>
      ) : (
        <SubmitButton pendingLabel="Saving…" size="lg" className="w-full">
          Save
        </SubmitButton>
      )}
    </form>
  );
}
