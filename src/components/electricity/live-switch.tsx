"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useState, useTransition } from "react";
import { useUndoToast } from "@/components/shared/undo-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { switchLiveMeter, undoLiveSwitch } from "@/features/electricity/actions";
import { liveForText } from "@/features/electricity/live";
import { addDays } from "@/lib/dates";

type Meter = { id: string; name: string };

/**
 * "Switch the house to Meter A" (issue #69, C102; board HSettingsMore: "Switching asks first"). A
 * dialog asks which day it happened (today by default, never before the last switch), then saves one
 * switch; the Undo message can take it back for a few seconds.
 */
export function SwitchLiveButton({
  target,
  current,
  since,
  today,
  label,
  variant = "outline",
  size = "default",
  quiet = false,
}: {
  target: Meter;
  /** The meter the house is on now; null when nothing is set yet. */
  current: Meter | null;
  /** The day the current meter became live. */
  since: string | null;
  today: string;
  label?: string;
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg";
  /**
   * The quiet trigger on a meter instrument (C131): the small IDLE tag itself, which only shows
   * "MAKE LIVE" on hover or focus, instead of a labelled button.
   */
  quiet?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const showUndo = useUndoToast();
  const yesterday = addDays(today, -1);
  const earliest = since ?? undefined;

  const confirm = () =>
    startTransition(async () => {
      const fd = new FormData();
      fd.set("meterId", target.id);
      fd.set("switchedOn", day);
      const res = await switchLiveMeter(fd);
      if (!res.ok || !res.switchId) {
        setError(res.error ?? "Could not save the switch.");
        return;
      }
      setOpen(false);
      const undo = new FormData();
      undo.set("id", res.switchId);
      showUndo(`The house is on ${target.name}.`, () => undoLiveSwitch(undo));
    });

  const chip = (value: string, text: string) => (
    <button
      type="button"
      onClick={() => setDay(value)}
      disabled={earliest !== undefined && value < earliest}
      aria-pressed={day === value}
      className={`min-h-9 rounded-full border px-3.5 text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 ${
        day === value ? "border-primary/50 bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {text}
    </button>
  );

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDay(today);
          setError(null);
        }
      }}
    >
      {quiet ? (
        <AlertDialog.Trigger
          render={
            <button
              type="button"
              aria-label={current ? `Switch the house to ${target.name}` : `Mark ${target.name} as live`}
              title={current ? `Switch the house to ${target.name}` : `Mark ${target.name} as live`}
              className="group -mx-2 flex min-h-8 items-center gap-1.5 rounded-full px-2 font-mono text-[10px] font-semibold tracking-[0.16em] text-label outline-none hover:text-primary focus-visible:text-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
          }
        >
          <span aria-hidden className="size-1.5 rounded-full bg-quiet group-hover:bg-primary group-focus-visible:bg-primary" />
          <span aria-hidden className="group-hover:hidden group-focus-visible:hidden">
            {current ? "IDLE" : "LIVE?"}
          </span>
          <span aria-hidden className="hidden group-hover:inline group-focus-visible:inline">
            MAKE LIVE
          </span>
        </AlertDialog.Trigger>
      ) : (
        <AlertDialog.Trigger render={<Button type="button" variant={variant} size={size} />}>{label ?? `Switch to ${target.name}`}</AlertDialog.Trigger>
      )}
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-1/2 flex-col gap-3.5 rounded-3xl border bg-card p-5 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.8)] transition duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <svg width="96" height="40" viewBox="0 0 96 40" aria-hidden>
            <circle cx="10" cy="20" r="6" fill="var(--primary)" />
            <path d="M16 20h22l14-12" fill="none" stroke="var(--primary)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M52 20h28" fill="none" stroke="var(--border)" strokeWidth={3} strokeLinecap="round" />
            <circle cx="86" cy="20" r="6" fill="none" stroke="var(--quiet)" strokeWidth={3} />
          </svg>
          <AlertDialog.Title className="font-display text-2xl leading-tight font-semibold tracking-tight">
            {current ? `Switch the house to ${target.name}?` : `Is ${target.name} live?`}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm leading-relaxed text-muted-foreground">
            {current
              ? `Flip the switch at the board first, then save it here. ${current.name} becomes idle.`
              : `Mark ${target.name} as the meter carrying the house now. You can switch any time.`}
          </AlertDialog.Description>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-muted-foreground">{current ? "Switched on" : "Live since"}</span>
            <div className="flex flex-wrap gap-2">
              {chip(today, "Today")}
              {chip(yesterday, "Yesterday")}
            </div>
            <Input type="date" aria-label="Day" value={day} min={earliest} max={today} onChange={(e) => setDay(e.target.value)} />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-status-overdue">
              {error}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <AlertDialog.Close render={<Button type="button" variant="outline" size="lg" />}>Not yet</AlertDialog.Close>
            <Button type="button" size="lg" disabled={pending || !day} onClick={confirm}>
              {pending ? "Saving…" : current ? "Yes, switched" : "Yes, it’s live"}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/**
 * The controls under the meter board: one "Switch to …" per idle meter once a meter is live, or
 * "Which meter is live?" with a button per meter while nothing is set.
 */
export function LiveControls({
  meters,
  live,
  today,
  framed = true,
  showStatus = true,
}: {
  meters: Meter[];
  live: { meterId: string; since: string } | null;
  today: string;
  /** Draw the dashed box around the "which is live?" question (off when already inside a card). */
  framed?: boolean;
  /** Say "Meter B is live for 4 days" next to the switch (off where the page says it already). */
  showStatus?: boolean;
}) {
  const current = live ? (meters.find((m) => m.id === live.meterId) ?? null) : null;
  if (!current) {
    return (
      <div className={`flex flex-wrap items-center gap-2.5 ${framed ? "rounded-2xl border border-dashed px-4 py-3" : ""}`}>
        <p className="mr-auto text-sm text-muted-foreground">Which meter is carrying the house now?</p>
        {meters.map((m) => (
          <SwitchLiveButton key={m.id} target={m} current={null} since={null} today={today} label={`${m.name} is live`} size="sm" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-end gap-2.5">
      {showStatus ? (
        <p className="mr-auto text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{current.name}</span> is live {liveForText(live!.since, today)}.
        </p>
      ) : null}
      {meters
        .filter((m) => m.id !== current.id)
        .map((m) => (
          <SwitchLiveButton key={m.id} target={m} current={current} since={live!.since} today={today} />
        ))}
    </div>
  );
}
