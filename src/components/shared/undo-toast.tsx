"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

type Toast = { id: number; text: string; undo: () => Promise<void> };
type Show = (text: string, undo: () => Promise<void>) => void;

const ToastContext = createContext<Show>(() => {});

/** How long the Undo message stays up (DESIGN.md, Sheets, dialogs, messages). */
const SHOW_MS = 6000;

/**
 * The Undo message (DESIGN.md; board HBillForms): a dark strip above the phone bar with a green dot,
 * one sentence, a blue Undo button and a line that drains over 6 seconds. It lives at the top of the
 * app, so it survives the page refreshing after the action it can undo. Show it with `useUndoToast()`.
 */
export function UndoToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- the portal target only exists in the browser
  useEffect(() => setMounted(true), []);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback<Show>(
    (text, undo) => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ id: Date.now(), text, undo });
      timer.current = setTimeout(hide, SHOW_MS);
    },
    [hide],
  );

  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {mounted && toast
        ? createPortal(
            <div
              key={toast.id}
              role="status"
              className="fixed inset-x-4 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md flex-col overflow-hidden rounded-2xl border bg-raised shadow-[0_20px_40px_-20px_rgb(0_0_0/0.8)] motion-safe:animate-[hub-toast-in_0.35s_ease-out_both] md:bottom-6"
            >
              <div className="flex items-center gap-3 py-2.5 pr-2.5 pl-4">
                <span aria-hidden className="size-2 shrink-0 rounded-full bg-status-ok" />
                <span className="flex-1 text-sm">{toast.text}</span>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await toast.undo();
                      hide();
                    })
                  }
                >
                  {pending ? "Undoing…" : "Undo"}
                </Button>
              </div>
              <span aria-hidden className="h-[3px] origin-left bg-primary motion-safe:animate-[hub-drain_6s_linear_forwards]" />
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

/** Shows the Undo message: `show("Meter B's Nov bill is paid.", async () => { ... })`. */
export function useUndoToast(): Show {
  return useContext(ToastContext);
}
