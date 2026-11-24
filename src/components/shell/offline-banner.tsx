"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { appConfig } from "@/config/app.config";

const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: appConfig.timeZone });

/** When the connection dropped, as "21:04"; set by the "offline" event. */
let offlineSince: string | null = null;

function subscribe(onChange: () => void) {
  const offline = () => {
    offlineSince = timeFormat.format(new Date());
    onChange();
  };
  window.addEventListener("offline", offline);
  window.addEventListener("online", onChange);
  return () => {
    window.removeEventListener("offline", offline);
    window.removeEventListener("online", onChange);
  };
}

/**
 * The offline strip at the top of every page (R.6; DESIGN.md "Offline banner", board HSystem): a Raised
 * strip with an amber wifi mark, when what is on screen is from, and Retry. Hidden while online, and on
 * the server (which is online by definition), so the first render always matches.
 */
export function OfflineBanner() {
  const router = useRouter();
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;

  return (
    <div role="status" className="flex items-center gap-3 rounded-xl border bg-raised px-3.5 py-2.5 text-sm">
      <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="var(--status-soon)" strokeWidth={1.8} strokeLinecap="round" aria-hidden className="shrink-0">
        <path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0M3 3l18 18" />
        <circle cx={12} cy={19.5} r={1.4} fill="var(--status-soon)" stroke="none" />
      </svg>
      <p className="min-w-0 flex-1">
        You’re offline. Showing what loaded {offlineSince ? <span className="font-mono">at {offlineSince}</span> : "earlier"}. Changes can’t be saved until
        you’re back.
      </p>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="hit-44 min-h-9 shrink-0 rounded-lg px-2.5 font-semibold text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        Retry
      </button>
    </div>
  );
}
