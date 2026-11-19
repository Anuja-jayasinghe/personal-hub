"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useEffect, useState, useTransition } from "react";
import { useUndoToast } from "@/components/shared/undo-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { markBillPaid, markBillUnpaid } from "@/features/electricity/actions";

function idForm(id: string, paidDate?: string) {
  const fd = new FormData();
  fd.set("id", id);
  if (paidDate) fd.set("paidDate", paidDate);
  return fd;
}

/**
 * "Mark paid" that asks first in a dialog (C80, R.3b; board HBillForms): what is being paid, the
 * amount, a paid-on date that defaults to today, then "Not yet" or "Yes, paid". Once paid, the Undo
 * message comes up for a few seconds; the bill can also be marked unpaid from its card or menu later.
 */
export function MarkPaidButton({
  billId,
  what,
  amount,
  today,
  size = "default",
  variant = "default",
}: {
  billId: string;
  /** "Meter B's Nov 2026 bill" */
  what: string;
  /** Formatted amount, if the bill has one. */
  amount: string | null;
  today: string;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const [paidDate, setPaidDate] = useState(today);
  const [pending, startTransition] = useTransition();
  const showUndo = useUndoToast();

  const confirm = () =>
    startTransition(async () => {
      await markBillPaid(idForm(billId, paidDate));
      setOpen(false);
      showUndo(`${what} is paid.`, () => markBillUnpaid(idForm(billId)));
    });

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger render={<Button type="button" size={size} variant={variant} />}>Mark paid</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-1/2 flex-col gap-3.5 rounded-3xl border bg-card p-5 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.8)] transition duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <svg width="56" height="40" viewBox="0 0 56 40" aria-hidden className="text-status-ok">
            <path d="M8 22l12 12L48 6" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="8" cy="22" r="4" fill="currentColor" />
            <circle cx="20" cy="34" r="4" fill="currentColor" />
            <circle cx="48" cy="6" r="4" fill="currentColor" />
          </svg>
          <AlertDialog.Title className="font-display text-2xl leading-tight font-semibold tracking-tight">Mark {what} paid?</AlertDialog.Title>
          <AlertDialog.Description className="text-sm leading-relaxed text-muted-foreground">
            {amount ? `${amount}. ` : ""}You can undo it for a few seconds after, or from the bill later.
          </AlertDialog.Description>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Paid on</span>
            <Input type="date" value={paidDate} max={today} onChange={(e) => setPaidDate(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <AlertDialog.Close render={<Button type="button" variant="outline" size="lg" />}>Not yet</AlertDialog.Close>
            <Button type="button" size="lg" disabled={pending || !paidDate} onClick={confirm}>
              {pending ? "Saving…" : "Yes, paid"}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/**
 * The PAID stamp (board HBillForms). It lands with a small thump the first time a paid bill is seen in
 * this browser session, then just sits there.
 */
export function PaidStamp({ billId }: { billId: string }) {
  const [land, setLand] = useState(false);
  useEffect(() => {
    try {
      const key = `hub:stamped:${billId}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- only known in the browser
      setLand(true);
    } catch {
      // storage blocked: just show the stamp still
    }
  }, [billId]);
  return (
    <span
      className={`inline-flex -rotate-[8deg] items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold tracking-[0.14em] text-status-ok ring-2 ring-status-ok ${
        land ? "motion-safe:animate-[hub-stamp_0.5s_cubic-bezier(.2,.8,.2,1)_both]" : ""
      }`}
    >
      PAID
    </span>
  );
}
