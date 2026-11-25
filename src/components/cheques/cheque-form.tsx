"use client";

import { useActionState, useEffect } from "react";
import { labelClass, labelTextClass, textareaClass } from "@/components/shared/form-styles";
import { SubmitButton } from "@/components/shared/submit-button";
import { useKeepValuesOnError } from "@/components/shared/use-keep-values-on-error";
import { Input } from "@/components/ui/input";
import type { Cheque } from "@/db/schema";
import { createCheque, updateCheque } from "@/features/cheques/actions";
import { staleDate } from "@/features/cheques/logic";
import { initialActionState } from "@/features/shared/types";
import { dayMonthIn } from "@/lib/dates";

/**
 * Add or edit a received cheque (createCheque / updateCheque). Who gave it, the amount and the cheque
 * date are the only required parts; the date is the earliest day it can be deposited. The photos are added
 * on the cheque itself afterwards (they need the cheque to exist first).
 */
export function ChequeForm({ cheque, today, onDone }: { cheque?: Cheque; today: string; onDone?: () => void }) {
  const [state, formAction] = useActionState(cheque ? updateCheque : createCheque, initialActionState);
  const { formRef, onSubmit } = useKeepValuesOnError(state);

  useEffect(() => {
    if (!state.ok) return;
    if (!cheque) formRef.current?.reset();
    onDone?.();
  }, [formRef, state, cheque, onDone]);

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="flex flex-col gap-3">
      {cheque ? <input type="hidden" name="id" value={cheque.id} /> : null}
      <label className={labelClass}>
        <span className={labelTextClass}>Who gave it to you</span>
        <Input name="fromParty" required maxLength={80} defaultValue={cheque?.fromParty} placeholder="e.g. Perera Hardware" autoComplete="off" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          <span className={labelTextClass}>Amount (LKR)</span>
          <Input name="amount" required inputMode="decimal" defaultValue={cheque?.amount} placeholder="0.00" autoComplete="off" />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Cheque date</span>
          <Input type="date" name="chequeDate" required defaultValue={cheque?.chequeDate ?? today} />
        </label>
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">
        The date written on it: the earliest day it can be deposited. It goes stale six months later
        {cheque ? ` (${dayMonthIn(staleDate(cheque.chequeDate), today)} for this one)` : ""}.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          <span className={labelTextClass}>Bank (optional)</span>
          <Input name="bank" maxLength={60} defaultValue={cheque?.bank ?? ""} placeholder="e.g. Sampath" autoComplete="off" />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Cheque number (optional)</span>
          <Input name="chequeNumber" maxLength={20} defaultValue={cheque?.chequeNumber ?? ""} inputMode="numeric" autoComplete="off" />
        </label>
      </div>
      <label className={labelClass}>
        <span className={labelTextClass}>Note (optional)</span>
        <textarea name="note" maxLength={300} defaultValue={cheque?.note ?? ""} className={textareaClass} />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {cheque ? (
        <div>
          <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        </div>
      ) : (
        <SubmitButton pendingLabel="Saving…" size="lg" className="w-full">
          Save the cheque
        </SubmitButton>
      )}
    </form>
  );
}
