"use client";

import { useActionState, useEffect } from "react";
import { labelClass, labelTextClass } from "@/components/shared/form-styles";
import { SubmitButton } from "@/components/shared/submit-button";
import { useKeepValuesOnError } from "@/components/shared/use-keep-values-on-error";
import { Input } from "@/components/ui/input";
import type { BillPayment } from "@/db/schema";
import { initialActionState, type ActionState } from "@/features/shared/types";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** Mark paid: the item being paid. */
  itemId?: string;
  /** Edit: the payment to change. */
  payment?: BillPayment;
  /** Mark paid: pre-filled paid date, usually today. */
  defaultDate?: string;
  /** Mark paid: pre-filled amount, the item's usual amount. */
  defaultAmount?: string | null;
};

/** Mark paid / edit a payment (markBillItemPaid / updateBillPayment). */
export function PaymentForm({ action, itemId, payment, defaultDate, defaultAmount }: Props) {
  const [state, formAction] = useActionState(action, initialActionState);
  const { formRef, onSubmit } = useKeepValuesOnError(state);

  useEffect(() => {
    if (state.ok && !payment) formRef.current?.reset();
  }, [formRef, state, payment]);

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="flex flex-col gap-3">
      {payment ? <input type="hidden" name="id" value={payment.id} /> : <input type="hidden" name="itemId" value={itemId} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelClass}>
          <span className={labelTextClass}>Paid on</span>
          <Input type="date" name="paidDate" required defaultValue={payment?.paidDate ?? defaultDate} />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Amount paid (optional, LKR)</span>
          <Input name="amount" enterKeyHint="next" inputMode="decimal" defaultValue={payment?.amount ?? defaultAmount ?? ""} placeholder="0.00" />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Note (optional)</span>
          <Input name="note" enterKeyHint="done" maxLength={500} defaultValue={payment?.note ?? ""} />
        </label>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div>
        <SubmitButton pendingLabel="Saving…">{payment ? "Save changes" : "Mark paid"}</SubmitButton>
      </div>
    </form>
  );
}
