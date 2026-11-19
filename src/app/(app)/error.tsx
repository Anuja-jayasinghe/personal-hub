"use client";

import { useEffect } from "react";
import { BrokenLink } from "@/components/shell/state-pictures";

/**
 * "Lost the connection" (R.6, board HStates): shown in place of a page that failed to load, inside the
 * shell, so the rest of the hub still works. Reconnect asks the server for the page again. The
 * reference is the error's digest, which matches the server log; no error text is shown.
 */
export default function PageError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : null;
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section
      role="alert"
      className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-3xl border border-raised bg-deepest px-5 py-8 text-center"
      style={{ backgroundImage: "radial-gradient(var(--card) 1px, transparent 1px)", backgroundSize: "14px 14px" }}
    >
      <BrokenLink />
      <h1 className="font-display text-[1.75rem] leading-tight font-semibold">Lost the connection</h1>
      <p className="max-w-[36ch] text-[15px] leading-relaxed text-muted-foreground">
        This page could not load just now. Your readings and bills are safe. Nothing was lost.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="flex min-h-12 w-full max-w-xs items-center justify-center rounded-xl bg-primary px-6 text-[15px] font-semibold text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-deepest"
      >
        Reconnect
      </button>
      {digest ? <p className="font-mono text-[10.5px] tracking-[0.12em] text-label uppercase">Ref {digest.slice(0, 8)}</p> : null}
      <p className="text-xs text-muted-foreground">The rest of the hub still works.</p>
    </section>
  );
}
