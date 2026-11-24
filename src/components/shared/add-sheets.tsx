"use client";

import { useState } from "react";
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

/** The two kinds of thing you can add on Bills, chosen before any field (S.5, owner's item 30). */
const CHOICES = [
  {
    key: "recurring",
    title: "Something that repeats",
    hint: "A bill or subscription you set up once. It comes back every month (or week, quarter, year) by itself.",
    examples: "Internet, water, Netflix, insurance",
  },
  {
    key: "once",
    title: "A one-time bill",
    hint: "A single bill you add by hand when it arrives.",
    examples: "A repair, school fees, a fine",
  },
] as const;

function AddBillChoice({ defaultDate, close }: { defaultDate: string; close: () => void }) {
  const [mode, setMode] = useState<"recurring" | "once" | null>(null);
  if (mode === null) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {CHOICES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setMode(c.key)}
            className="flex flex-col gap-2 rounded-2xl border bg-background p-4 text-left outline-none hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="font-display text-xl font-semibold">{c.title}</span>
            <span className="text-sm leading-relaxed text-muted-foreground">{c.hint}</span>
            <span className="mt-auto font-mono text-[10.5px] tracking-[0.1em] text-label uppercase">{c.examples}</span>
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={() => setMode(null)} className="hit-44 self-start rounded-md text-sm text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
        ← {mode === "recurring" ? "Something that repeats" : "A one-time bill"} · change
      </button>
      <BillItemForm action={createBillItem} defaultDate={defaultDate} onDone={close} mode={mode} />
    </div>
  );
}

export function AddBillItemSheet({ defaultDate }: { defaultDate: string }) {
  return (
    <SheetButton label="Add to Bills" title="What are you adding?" crumb="/ Bills / New" variant="default">
      {(close) => <AddBillChoice defaultDate={defaultDate} close={close} />}
    </SheetButton>
  );
}
