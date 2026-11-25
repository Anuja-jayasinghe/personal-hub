"use client";

import { ChequeForm } from "@/components/cheques/cheque-form";
import { StatusForm } from "@/components/cheques/status-form";
import { SheetButton } from "@/components/shared/sheet-button";

/** "Add a cheque" as a bottom sheet (a window on a wide screen), like the other add forms. */
export function AddChequeSheet({ today }: { today: string }) {
  return (
    <SheetButton label="Add a cheque" title="A cheque you received" crumb="/ Cheques / New" variant="default">
      {(close) => <ChequeForm today={today} onDone={close} />}
    </SheetButton>
  );
}

/** "Mark deposited" for a waiting cheque: asks the day it went to the bank (today to begin with). */
export function DepositSheet({ id, today }: { id: string; today: string }) {
  return (
    <SheetButton label="Mark deposited" title="Deposited at the bank" crumb="/ Cheques / Deposit" variant="default" plus={false}>
      {(close) => <StatusForm id={id} to="deposited" label="Save as deposited" size="lg" variant="default" depositDate={today} onDone={close} />}
    </SheetButton>
  );
}
