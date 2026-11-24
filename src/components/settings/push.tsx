"use client";

import { Share, SquarePlus, X } from "lucide-react";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { SettingsSection } from "@/components/settings/settings-ui";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app.config";
import { removePushDevice, sendTestPush, setPushLive, subscribePush, unsubscribePush } from "@/features/notifications/actions";
import { base64UrlToBytes, deviceState, isAppleMobile, type DeviceState } from "@/features/notifications/push/device-state";
import { deviceLabelFrom } from "@/features/notifications/push/subscription";
import type { PushDevice, PushSetup } from "@/features/notifications/queries";
import { dayMonth, todayIn } from "@/lib/dates";

/**
 * Settings › Notifications › "This iPhone" (Notifications N.3, DECISIONS C140; owner only, inside the
 * page's OwnerOnly). The browser decides the state (device-state.ts); permission is only ever asked
 * from a tap. `DeviceView` and `DeviceList` only draw, so every state can be looked at without a phone.
 */

const name = appConfig.name;

/** The hub and this device as two nodes on a line (DESIGN.md: node-and-line): solid blue when pushes reach it. */
function Link({ state, device }: { state: DeviceState; device: string }) {
  const on = state === "on";
  const broken = state === "blocked";
  const words: Record<DeviceState, string> = {
    on: `Pushes reach this ${device}`,
    off: `Pushes are off on this ${device}`,
    blocked: `Pushes are blocked on this ${device}`,
    "install-first": `This ${device} needs ${name} on its Home Screen first`,
    unsupported: "This browser cannot receive pushes",
    "not-set-up": "Push is not set up on the server yet",
  };
  const node = (filled: boolean) => (
    <span aria-hidden className={`size-3 shrink-0 rounded-full border-2 ${filled ? "border-primary bg-primary" : "border-quiet bg-transparent"}`} />
  );
  return (
    <div role="img" aria-label={words[state]} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {node(true)}
        {broken ? (
          <span aria-hidden className="flex flex-1 items-center gap-2">
            <span className="h-0.5 flex-1 bg-quiet" />
            <X className="size-3.5 text-quiet" strokeWidth={2.2} />
            <span className="h-0.5 flex-1 bg-quiet" />
          </span>
        ) : (
          <span aria-hidden className={`flex-1 border-t-2 ${on ? "border-primary" : "border-dashed border-quiet"}`} />
        )}
        {node(on)}
      </div>
      <div aria-hidden className="flex justify-between font-mono text-[10px] tracking-[0.14em] text-label uppercase">
        <span>{name}</span>
        <span className={on ? "text-primary" : undefined}>{device}</span>
      </div>
    </div>
  );
}

export type DeviceViewProps = {
  state: DeviceState;
  device: string;
  busy?: boolean;
  /** A short result line after an action ("Sent. Check the lock screen."). */
  message?: { tone: "ok" | "error"; text: string } | null;
  onTurnOn?: () => void;
  onTurnOff?: () => void;
  onTest?: () => void;
};

/** What this device can do now, under the link: one sentence at most and the one action. */
export function DeviceView({ state, device, busy, message, onTurnOn, onTurnOff, onTest }: DeviceViewProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card px-4 py-4">
      <Link state={state} device={device} />

      {state === "on" ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button variant="outline" size="lg" disabled={busy} onClick={onTest} className="flex-1 sm:flex-none">
            Send a test
          </Button>
          <button
            type="button"
            disabled={busy}
            onClick={onTurnOff}
            className="min-h-11 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            Turn off here
          </button>
        </div>
      ) : null}

      {state === "off" ? (
        <Button size="lg" disabled={busy} onClick={onTurnOn} className="w-full sm:w-auto sm:self-start">
          Turn on pushes
        </Button>
      ) : null}

      {state === "install-first" ? (
        <ol className="flex flex-col gap-2.5 text-sm" aria-label={`Add ${name} to the Home Screen`}>
          <li className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-raised ring-1 ring-border">
              <Share className="size-4 text-primary" aria-hidden />
            </span>
            <span>
              Tap <strong className="font-semibold">Share</strong> in Safari
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-raised ring-1 ring-border">
              <SquarePlus className="size-4 text-primary" aria-hidden />
            </span>
            <span>
              Choose <strong className="font-semibold">Add to Home Screen</strong>
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-raised ring-1 ring-border">
              {/* The app icon itself, so the step is recognisable on the Home Screen. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/hub-192.png" alt="" className="size-5 rounded" />
            </span>
            <span>Open {name} from there and come back to this page</span>
          </li>
        </ol>
      ) : null}

      {state === "blocked" ? (
        <p className="text-sm text-muted-foreground">
          To allow them again, open the {device}&rsquo;s <strong className="font-semibold text-foreground">Settings › Notifications › {name}</strong> and turn on
          Allow Notifications.
        </p>
      ) : null}

      {state === "unsupported" ? <p className="text-sm text-muted-foreground">Open {name} from an iPhone&rsquo;s Home Screen (iOS 16.4 or later).</p> : null}

      {state === "not-set-up" ? <p className="text-sm text-muted-foreground">The server needs its VAPID keys (see HOSTING.md).</p> : null}

      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={`text-sm ${message.tone === "error" ? "text-status-overdue" : "text-status-ok"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}

const shortDay = (d: Date) => dayMonth(todayIn(appConfig.timeZone, d));

/** The owner's devices with pushes on; removing one is rare, so it is a small icon button. */
export function DeviceList({ devices, thisHash, busy, onRemove }: { devices: PushDevice[]; thisHash: string | null; busy?: boolean; onRemove?: (id: string) => void }) {
  if (devices.length === 0) return null;
  return (
    <ul className="flex flex-col divide-y divide-raised rounded-2xl border bg-card px-4">
      {devices.map((d) => (
        <li key={d.id} className="flex min-h-14 items-center gap-3">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-3">
            <span className="flex items-baseline gap-2 text-[15px] font-semibold">
              {d.label}
              {d.endpointHash === thisHash ? <span className="font-mono text-[10px] font-normal tracking-[0.12em] text-primary uppercase">This one</span> : null}
            </span>
            <span className="text-[12.5px] text-muted-foreground">
              {d.gone ? "Stopped accepting pushes" : d.lastOkAt ? `Last reached ${shortDay(d.lastOkAt)}` : `Added ${shortDay(d.createdAt)} · nothing sent yet`}
            </span>
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => onRemove?.(d.id)}
            aria-label={`Remove ${d.label}`}
            className="flex size-11 items-center justify-center rounded-lg text-quiet outline-none hover:bg-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <X className="size-4" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Detected = { state: DeviceState; device: string; thisHash: string | null };

const UNSUPPORTED: Detected = { state: "unsupported", device: "browser", thisHash: null };

/** True when the subscription was made with this VAPID public key (a new key pair needs a new subscription). */
function sameKey(sub: PushSubscription, publicKey: string): boolean {
  const key = sub.options?.applicationServerKey;
  if (!key) return false;
  const a = new Uint8Array(key);
  const b = base64UrlToBytes(publicKey);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

async function detect(setup: PushSetup): Promise<Detected> {
  const device = deviceLabelFrom(navigator.userAgent, navigator.maxTouchPoints);
  const apple = isAppleMobile(navigator.userAgent, navigator.maxTouchPoints);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const hasServiceWorker = "serviceWorker" in navigator;
  const hasPushManager = "PushManager" in window;
  const hasNotification = "Notification" in window;
  let thisHash: string | null = null;
  if (setup.configured && hasServiceWorker && hasPushManager) {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    const sub = await reg.pushManager.getSubscription();
    if (sub) thisHash = await sha256Hex(sub.endpoint);
  }
  const state = deviceState({
    configured: setup.configured,
    isAppleMobile: apple,
    standalone,
    hasServiceWorker,
    hasPushManager,
    hasNotification,
    permission: hasNotification ? Notification.permission : "default",
    subscribedHere: thisHash !== null && setup.devices.some((d) => d.endpointHash === thisHash && !d.gone),
  });
  return { state, device: device === "Browser" ? "browser" : device, thisHash };
}

/**
 * "This iPhone" ("This device" elsewhere): works out the state in the browser, then offers the one
 * thing that can be done. Renders its own section, so the heading can name the device.
 */
export function ThisDevice({ setup }: { setup: PushSetup }) {
  const [detected, setDetected] = useState<Detected | null>(null);
  const [message, setMessage] = useState<DeviceViewProps["message"]>(null);
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    let live = true;
    detect(setup)
      .then((d) => live && setDetected(d))
      .catch(() => live && setDetected(UNSUPPORTED));
    return () => {
      live = false;
    };
  }, [setup]);

  const run = (work: () => Promise<{ tone: "ok" | "error"; text: string } | null>) =>
    startTransition(async () => {
      try {
        setMessage(await work());
      } catch {
        setMessage({ tone: "error", text: "Something went wrong. Please try again." });
      }
      setDetected(await detect(setup).catch(() => UNSUPPORTED));
    });

  const turnOn = () =>
    run(async () => {
      if (!setup.publicKey) return { tone: "error", text: "Push is not set up on the server yet." };
      // Asked only here, from the tap (iOS refuses a request that does not come from one).
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return permission === "denied" ? null : { tone: "error", text: "Pushes stay off until you allow them." };
      const reg = await navigator.serviceWorker.ready;
      // Drop the browser's subscription and make a new one when it was made with another key pair (it
      // cannot receive our pushes), or when it is not live in the list (not saved, or marked gone): saving
      // it again could store an endpoint the push service already refuses.
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        const hash = await sha256Hex(existing.endpoint);
        const live = setup.devices.some((d) => d.endpointHash === hash && !d.gone);
        if (!sameKey(existing, setup.publicKey) || !live) await existing.unsubscribe();
      }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(setup.publicKey) });
      const res = await subscribePush(sub.toJSON(), deviceLabelFrom(navigator.userAgent, navigator.maxTouchPoints));
      if (!res.ok) {
        await sub.unsubscribe().catch(() => {});
        return { tone: "error", text: res.error ?? "Could not turn pushes on." };
      }
      return { tone: "ok", text: "On. Send a test to check." };
    });

  const turnOff = () =>
    run(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const res = await unsubscribePush(sub.endpoint);
        await sub.unsubscribe().catch(() => {});
        if (!res.ok) return { tone: "error", text: res.error ?? "Could not turn pushes off." };
      }
      return null;
    });

  const test = () =>
    run(async () => {
      // To this device only: the server matches the hash of its endpoint against the caller's own devices.
      const res = await sendTestPush(detected?.thisHash ?? null);
      return res.ok ? { tone: "ok", text: "Sent. It should arrive in a few seconds." } : { tone: "error", text: res.error ?? "Could not send the test." };
    });

  const remove = (id: string) =>
    run(async () => {
      const res = await removePushDevice(id);
      return res.ok ? null : { tone: "error", text: res.error ?? "Could not remove it." };
    });

  const label = detected?.device === "iPhone" || detected?.device === "iPad" ? `This ${detected.device}` : "This device";
  return (
    <SettingsSection label={label}>
      {detected ? (
        <>
          <DeviceView state={detected.state} device={detected.device} busy={busy} message={message} onTurnOn={turnOn} onTurnOff={turnOff} onTest={test} />
          <DeviceList devices={setup.devices} thisHash={detected.thisHash} busy={busy} onRemove={remove} />
        </>
      ) : (
        <div aria-busy className="h-36 animate-pulse rounded-2xl border bg-card" />
      )}
    </SettingsSection>
  );
}

/** The iPhone channel's switch: off, the morning run only logs what it would push; on, it pushes for real. */
export function PushLiveSwitch({ on, configured }: { on: boolean; configured: boolean }) {
  // Shows the new position at once; the saved value comes back from the server (the action refreshes),
  // and on a failure the switch falls back to it by itself.
  const [checked, setOptimistic] = useOptimistic(on);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const toggle = () =>
    startTransition(async () => {
      const next = !checked;
      setOptimistic(next);
      const res = await setPushLive(next);
      setError(res.ok ? null : (res.error ?? "Could not save."));
    });

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="Send iPhone pushes"
        // Without the keys it can still be turned OFF (a switch left on from before), never on.
        disabled={busy || (!configured && !checked)}
        onClick={toggle}
        className={`relative h-[26px] w-11 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 ${checked ? "bg-primary" : "bg-raised ring-1 ring-border"}`}
      >
        <span aria-hidden className={`absolute top-[3px] size-5 rounded-full transition-[left] ${checked ? "left-[21px] bg-primary-foreground" : "left-[3px] bg-quiet"}`} />
      </button>
      {error ? (
        <span role="alert" className="max-w-48 text-right text-xs text-status-overdue">
          {error}
        </span>
      ) : null}
    </span>
  );
}
