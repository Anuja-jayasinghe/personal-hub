"use client";

import { useActionState, useState, useTransition } from "react";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { addPerson, setAccess } from "@/features/people/actions";
import { AREAS, type Area, type Level } from "@/features/people/access";
import { initialActionState } from "@/features/shared/types";

/** Add someone by email (S.8, C114): they can use the hub once they sign in, seeing only what you give them. */
export function AddPersonForm() {
  const [state, action] = useActionState(addPerson, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Their email address</span>
          <Input name="email" type="email" required placeholder="name@example.com" autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Name (optional)</span>
          <Input name="name" maxLength={80} placeholder="e.g. Thaththa" />
        </label>
        <SubmitButton pendingLabel="Adding…">Add person</SubmitButton>
      </div>
      <p className="text-xs text-muted-foreground">They sign in with this address (Google or an email code). They see nothing until you give them a section.</p>
      {state.error ? (
        <p role="alert" className="text-sm text-status-overdue">
          {state.error}
        </p>
      ) : state.ok ? (
        <p role="status" className="text-sm text-status-ok">
          Added. Now choose what they can see.
        </p>
      ) : null}
    </form>
  );
}

const CHOICES: { value: Level | "hidden"; label: string }[] = [
  { value: "hidden", label: "Hidden" },
  { value: "see", label: "See" },
  { value: "add", label: "Add" },
  { value: "edit", label: "Edit" },
];

/**
 * One person's access, a row per section with Hidden / See / Add / Edit (S.8, C114; board HAdmin). A tap
 * saves that section straight away. See = look only; Add = also add new things; Edit = also change and delete.
 */
export function AccessGrid({ personId, grants }: { personId: string; grants: Partial<Record<Area, Level>> }) {
  const [levels, setLevels] = useState<Partial<Record<Area, Level>>>(grants);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const choose = (area: Area, value: Level | "hidden") =>
    startTransition(async () => {
      const before = levels;
      setLevels((l) => {
        const next = { ...l };
        if (value === "hidden") delete next[area];
        else next[area] = value;
        return next;
      });
      const fd = new FormData();
      fd.set("personId", personId);
      fd.set("area", area);
      fd.set("level", value);
      const res = await setAccess(fd);
      if (!res.ok) {
        setLevels(before);
        setError(res.error ?? "Could not save.");
      } else setError(null);
    });

  return (
    <div className="flex flex-col divide-y divide-raised" aria-busy={pending}>
      {AREAS.map((a) => {
        const current = levels[a.key] ?? "hidden";
        return (
          <div key={a.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
            <span className="flex min-w-48 flex-1 flex-col">
              <span className="text-sm font-semibold">{a.label}</span>
              <span className="text-xs text-muted-foreground">{a.hint}</span>
            </span>
            <span role="radiogroup" aria-label={`${a.label} access`} className="grid grid-cols-4 gap-1 rounded-xl bg-deepest p-1 ring-1 ring-border">
              {CHOICES.map((c) => {
                const on = current === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => (on ? null : choose(a.key, c.value))}
                    className={`min-h-8 rounded-lg px-2.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      on ? (c.value === "hidden" ? "bg-raised text-foreground" : "bg-accent text-foreground ring-1 ring-primary/45") : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </span>
          </div>
        );
      })}
      {error ? (
        <p role="alert" className="pt-2 text-sm text-status-overdue">
          {error}
        </p>
      ) : null}
    </div>
  );
}
