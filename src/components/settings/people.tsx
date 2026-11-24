"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { addPerson, setAccess } from "@/features/people/actions";
import { AREAS, type Area, type Level } from "@/features/people/access";
import { summariseAccess } from "@/features/people/access-summary";
import { INVITE_PRESETS, DEFAULT_PRESET, presetFor } from "@/features/people/invite-presets";
import { resendInvitation, inviteSomeone, withdrawInvitation } from "@/features/people/invitation-actions";
import { initialActionState } from "@/features/shared/types";

/** Add someone by email, without sending anything (S.8, C114): they can use the hub once they sign in, seeing only what you give them. */
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
      <p className="text-xs text-muted-foreground">Nothing is sent. They sign in with this address (Google or an email code) and see nothing until you give them a section.</p>
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
 * A row per section with Hidden / See / Add / Edit (S.8, C114; board HAdmin). See = look only; Add = also
 * add new things; Edit = also change and delete. It only reports the tap: the caller decides what to do
 * with it (save it for a person, or hold it in the Invite form).
 */
function AccessLevelsGrid({ levels, onChoose, error, busy }: { levels: Partial<Record<Area, Level>>; onChoose: (area: Area, value: Level | "hidden") => void; error?: string | null; busy?: boolean }) {
  return (
    <div className="flex flex-col divide-y divide-raised" aria-busy={busy}>
      {AREAS.map((a) => {
        const current = levels[a.key] ?? "hidden";
        return (
          <div key={a.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
            <span className="flex min-w-48 flex-1 flex-col">
              <span className="text-sm font-semibold">{a.label}</span>
              <span className="text-xs text-muted-foreground">{a.hint}</span>
            </span>
            <span role="radiogroup" aria-label={`${a.label} access`} className="grid w-full grid-cols-4 gap-1 rounded-xl bg-deepest p-1 ring-1 ring-border sm:w-auto">
              {CHOICES.map((c) => {
                const on = current === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => (on ? null : onChoose(a.key, c.value))}
                    className={`min-h-11 rounded-lg px-2.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 ${
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

const withLevel = (levels: Partial<Record<Area, Level>>, area: Area, value: Level | "hidden") => {
  const next = { ...levels };
  if (value === "hidden") delete next[area];
  else next[area] = value;
  return next;
};

/** One person's access: a tap saves that section straight away. */
export function AccessGrid({ personId, grants }: { personId: string; grants: Partial<Record<Area, Level>> }) {
  const [levels, setLevels] = useState<Partial<Record<Area, Level>>>(grants);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const choose = (area: Area, value: Level | "hidden") =>
    startTransition(async () => {
      const before = levels;
      setLevels((l) => withLevel(l, area, value));
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

  return <AccessLevelsGrid levels={levels} onChoose={choose} error={error} busy={pending} />;
}

/**
 * Invite someone (issue #236): their email, what they will be able to do, and Send. The access is chosen
 * BEFORE sending, from a few presets, with the full grid tucked away under "Customise access". The words
 * under the presets say, in plain language, exactly what the person will get.
 */
export function InviteForm() {
  const [state, action] = useActionState(inviteSomeone, initialActionState);
  const [levels, setLevels] = useState<Partial<Record<Area, Level>>>(DEFAULT_PRESET.grants);
  const formRef = useRef<HTMLFormElement>(null);
  const selected = presetFor(levels);
  const summary = summariseAccess(levels);

  // After a saved invitation the form is ready for the next person (the access choice stays).
  useEffect(() => {
    if (state.ok && state.id) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Their email address</span>
          <Input name="email" type="email" required placeholder="name@example.com" autoComplete="off" className="h-11" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Name (optional)</span>
          <Input name="name" maxLength={80} placeholder="e.g. Thaththa" autoComplete="off" className="h-11" />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-sm text-muted-foreground">What can they do?</legend>
        <div role="radiogroup" aria-label="Access" className="flex flex-wrap gap-2">
          {INVITE_PRESETS.map((p) => {
            const on = selected?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setLevels(p.grants)}
                className={`min-h-11 rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  on ? "border-primary/60 bg-accent text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            );
          })}
          {selected ? null : <span className="inline-flex min-h-11 items-center rounded-full border border-primary/60 bg-accent px-4 text-sm font-medium">Custom</span>}
        </div>
        <p className="text-sm">
          {summary.length > 0 ? (
            summary.map((line, i) => (
              <span key={line}>
                {i > 0 ? <span className="text-muted-foreground"> · </span> : null}
                {line}
              </span>
            ))
          ) : (
            <span className="text-status-overdue">Choose at least one section.</span>
          )}
        </p>
        {selected ? <p className="text-xs text-muted-foreground">{selected.hint}</p> : null}
      </fieldset>

      <details className="group rounded-xl border border-raised bg-deepest/40 px-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <span>Customise access</span>
          <span className="text-xs text-primary group-open:hidden">Open</span>
          <span className="hidden text-xs text-muted-foreground group-open:inline">Close</span>
        </summary>
        <div className="pb-2">
          <AccessLevelsGrid levels={levels} onChoose={(area, value) => setLevels((l) => withLevel(l, area, value))} />
        </div>
      </details>

      {AREAS.map((a) => (
        <input key={a.key} type="hidden" name={`access:${a.key}`} value={levels[a.key] ?? "hidden"} />
      ))}

      <div className="flex flex-col gap-2">
        <SubmitButton size="lg" pendingLabel="Sending…" className="h-12 w-full sm:w-auto sm:self-start" disabled={summary.length === 0}>
          Send invitation
        </SubmitButton>
        <p className="text-xs text-muted-foreground">They get an email with a sign-up link that works for 14 days. Nothing is shared until they sign up with that address.</p>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-status-overdue">
          {state.error}
        </p>
      ) : state.notice ? (
        <p role="status" className="text-sm text-status-ok">
          {state.notice}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Resend and Withdraw for a waiting invitation (issue #236). Resend is disabled while the cooldown or the
 * cap says no, and says why. Withdraw asks first and deletes the placeholder, nothing else.
 */
export function InviteActions({ personId, label, canResend, resendNote, ended }: { personId: string; label: string; canResend: boolean; resendNote: string | null; ended: boolean }) {
  const [resent, resend] = useActionState(resendInvitation, initialActionState);
  const [withdrawn, withdraw] = useActionState(withdrawInvitation, initialActionState);
  const message = resent.error ?? withdrawn.error ?? resent.notice ?? null;
  const failed = Boolean(resent.error ?? withdrawn.error);
  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <form action={resend}>
          <input type="hidden" name="id" value={personId} />
          <SubmitButton variant={ended ? "default" : "outline"} className="h-11 sm:h-8" pendingLabel="Sending…" disabled={!canResend}>
            Resend
          </SubmitButton>
        </form>
        <form action={withdraw}>
          <input type="hidden" name="id" value={personId} />
          <SubmitButton variant="ghost" className="h-11 text-status-overdue sm:h-8" confirm={`Withdraw the invitation for ${label}? It is deleted, and nothing was shared.`}>
            Withdraw
          </SubmitButton>
        </form>
      </div>
      {message ? (
        <p role={failed ? "alert" : "status"} className={`text-xs ${failed ? "text-status-overdue" : "text-status-ok"}`}>
          {message}
        </p>
      ) : !canResend && resendNote ? (
        <p className="text-xs text-muted-foreground">{resendNote}</p>
      ) : null}
    </div>
  );
}
