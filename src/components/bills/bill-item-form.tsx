"use client";

import { useActionState, useEffect, useState } from "react";
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
  /** What is being added (S.5): something that repeats, or a single bill. Edits follow the item. */
  mode?: "recurring" | "once";
};

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none md:text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

/**
 * Add / edit form for a bill or subscription (createBillItem / updateBillItem). Two shapes (S.5, owner's
 * items 30 and 31):
 * - **recurring**: a monthly item asks the day of the month the bill arrives; it is due before the next
 *   one arrives. Weekly, quarterly and yearly items still ask for their next due date.
 * - **once**: a single bill with its due date (added by hand each time).
 */
export function BillItemForm({ action, item, defaultDate, onDone, mode }: Props) {
  const [state, formAction] = useActionState(action, initialActionState);
  const { formRef, onSubmit } = useKeepValuesOnError(state);
  const shape = mode ?? (item?.frequency === "one_off" ? "once" : "recurring");
  const [frequency, setFrequency] = useState<string>(item?.frequency && item.frequency !== "one_off" ? item.frequency : "monthly");
  const byBillDay = shape === "recurring" && frequency === "monthly";
  const defaultBillDay = item?.anchorDay ?? Number((defaultDate ?? "2000-01-01").slice(8, 10));

  useEffect(() => {
    if (!state.ok) return;
    if (!item) formRef.current?.reset();
    onDone?.();
  }, [formRef, state, item, onDone]);

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="flex flex-col gap-3">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className={`${labelClass} ${shape === "once" ? "sm:col-span-2" : ""}`}>
          <span className={labelTextClass}>Name</span>
          <Input name="name" enterKeyHint="next" required maxLength={80} defaultValue={item?.name} placeholder={shape === "once" ? "e.g. Plumber, School fees" : "e.g. Dialog fibre, Netflix"} />
        </label>
        {shape === "recurring" ? (
          <>
            <label className={labelClass}>
              <span className={labelTextClass}>Type</span>
              <select name="kind" defaultValue={item?.kind ?? "bill"} className={selectClass}>
                <option value="bill">Bill</option>
                <option value="subscription">Subscription</option>
              </select>
            </label>
            <label className={labelClass}>
              <span className={labelTextClass}>How often</span>
              <select name="frequency" required value={frequency} onChange={(e) => setFrequency(e.target.value)} className={selectClass}>
                {FREQUENCIES.filter((f) => f !== "one_off").map((f) => (
                  <option key={f} value={f}>
                    {FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            <input type="hidden" name="kind" value="bill" />
            <input type="hidden" name="frequency" value="one_off" />
            <label className={labelClass}>
              <span className={labelTextClass}>Due date</span>
              <Input type="date" name="nextDueDate" required defaultValue={item?.nextDueDate ?? defaultDate} />
            </label>
          </>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {shape === "recurring" ? (
          byBillDay ? (
            <label className={labelClass}>
              <span className={labelTextClass}>The bill arrives each month on</span>
              <select name="billDay" required defaultValue={String(defaultBillDay)} className={selectClass}>
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    the {ordinal(d)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className={labelClass}>
              <span className={labelTextClass}>Next due date</span>
              <Input type="date" name="nextDueDate" required defaultValue={item?.nextDueDate ?? defaultDate} />
            </label>
          )
        ) : null}
        <label className={labelClass}>
          <span className={labelTextClass}>{shape === "once" ? "Amount (optional, LKR)" : "Usual amount (optional, LKR)"}</span>
          <Input name="amount" enterKeyHint="next" inputMode="decimal" defaultValue={item?.amount ?? ""} placeholder="0.00" />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Paid with (optional label)</span>
          <Input name="paymentMethod" enterKeyHint="next" maxLength={60} defaultValue={item?.paymentMethod ?? ""} placeholder="e.g. Visa, Sampath" />
        </label>
      </div>
      {byBillDay ? <p className="-mt-1 text-xs text-muted-foreground">Each month&apos;s bill is due before the next one arrives.</p> : null}
      <p className="-mt-1 text-xs text-muted-foreground">Write a label only. Card numbers are never stored, and the app refuses anything that looks like one.</p>

      {shape === "recurring" ? (
        <label className="flex items-center gap-2 text-sm pointer-coarse:min-h-11">
          <input type="checkbox" name="autopay" defaultChecked={item?.autopay ?? false} className="size-4" />
          Paid automatically (autopay)
        </label>
      ) : null}

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
          {shape === "once" ? "Save the bill" : "Save the recurring item"}
        </SubmitButton>
      )}
    </form>
  );
}
