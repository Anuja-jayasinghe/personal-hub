"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { setChequeStatus } from "@/features/cheques/actions";
import { initialActionState } from "@/features/shared/types";
import type { ChequeStatus } from "@/db/schema/cheques";

/**
 * One button that moves a cheque to another status (setChequeStatus), with its own error line. Marking it
 * deposited also asks the day it was deposited (today to begin with). `confirm` asks first for a step that
 * is hard to take back in the head (bounced, cancelled).
 */
export function StatusForm({
  id,
  to,
  label,
  variant = "outline",
  size = "default",
  confirm,
  depositDate,
  onDone,
  className,
}: {
  id: string;
  to: ChequeStatus;
  label: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  confirm?: string;
  /** Marking deposited: ask for the day, starting from this one (today). */
  depositDate?: string;
  onDone?: () => void;
  className?: string;
}) {
  const [state, formAction] = useActionState(
    async (prev: typeof initialActionState, fd: FormData) => {
      const next = await setChequeStatus(prev, fd);
      if (next.ok) onDone?.();
      return next;
    },
    initialActionState,
  );
  return (
    <form action={formAction} className={`flex flex-col gap-2 ${className ?? ""}`}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={to} />
      {depositDate ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Deposited on</span>
          <Input type="date" name="depositedOn" required defaultValue={depositDate} max={depositDate} />
        </label>
      ) : null}
      <SubmitButton variant={variant} size={size} pendingLabel="Saving…" confirm={confirm}>
        {label}
      </SubmitButton>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
