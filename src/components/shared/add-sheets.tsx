"use client";

import { BillItemForm } from "@/components/bills/bill-item-form";
import { NoteForm } from "@/components/shared/note-form";
import { SheetButton } from "@/components/shared/sheet-button";
import { TaskForm } from "@/components/shared/task-form";
import { createBillItem } from "@/features/bills/actions";
import { createNote, createTask } from "@/features/shared/actions";
import type { OwnerRef } from "@/lib/owners";

/**
 * The "add" forms for tasks, notes and bills as bottom sheets (R.5b; boards HTasksNotes, HBills).
 * Client wrappers, because a sheet closes itself after saving and the panels render on the server.
 */

export function AddTaskSheet({ owner, itemName = "task" }: { owner: OwnerRef | null; itemName?: string }) {
  return (
    <SheetButton label={`Add a ${itemName}`} title={`Add a ${itemName}`} crumb={`/ Tasks / New ${itemName}`} variant="default">
      {(close) => <TaskForm action={createTask} owner={owner} addLabel={`Save ${itemName}`} onDone={close} />}
    </SheetButton>
  );
}

export function AddNoteSheet({ owner, quiet = false }: { owner: OwnerRef | null; quiet?: boolean }) {
  return (
    <SheetButton label="Add a note" title="Add a note" crumb="/ Notes / New note" variant={quiet ? "outline" : "default"}>
      {(close) => <NoteForm action={createNote} owner={owner} onDone={close} />}
    </SheetButton>
  );
}

export function AddBillItemSheet({ defaultDate }: { defaultDate: string }) {
  return (
    <SheetButton
      label="Add a bill or subscription"
      title="Add a bill or subscription"
      crumb="/ Bills / New"
      description="Something you pay again and again, with its next due date and usual amount."
      variant="default"
    >
      {(close) => <BillItemForm action={createBillItem} defaultDate={defaultDate} onDone={close} />}
    </SheetButton>
  );
}
