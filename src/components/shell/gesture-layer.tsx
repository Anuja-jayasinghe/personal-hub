"use client";

import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import {
  classifyGesture,
  edgeProgress,
  gestureTargetFacts,
  pastSlop,
  pullTravel,
  shouldCommit,
  springMs,
  type GestureKind,
  type Point,
  type TargetLike,
} from "@/lib/gestures";
import { isInstalledApp } from "@/lib/installed-app";

/**
 * Touch gestures for the whole app, mounted once in the (app) layout (issue #176, DECISIONS C156).
 *
 *  - Back and forward by a swipe from the left / right screen edge, and pull to refresh at the top of the page:
 *    only in the INSTALLED app (a normal browser tab already has both, and the hub never fights it).
 *  - A sideways swipe between a vehicle's Overview and Documents tabs: on any touch screen, only where the page
 *    marks its content with `data-tab-prev` / `data-tab-next` (the addresses to go to).
 *
 * The decisions are in `@/lib/gestures` (pure, tested); this file only reads touch events and moves two small
 * fixed, click-through pieces (the edge cue and the pull indicator), which never change the layout. Normal
 * scrolling is never blocked: the listeners are passive in a browser tab, and in the installed app the one
 * non-passive `touchmove` calls `preventDefault` only after an edge swipe or a pull has been recognised.
 * Everything stands down while a dialog, sheet, menu or popover is open, while a text field has focus, for a
 * second finger, and for anything that owns its touch (fields, sliders, charts, sideways-scrolling strips,
 * `[data-no-gesture]`).
 */

const OVERLAY_SELECTOR = [
  "[role='dialog']",
  "[role='alertdialog']",
  "[role='menu']",
  "[role='listbox']",
  "[data-slot='popover-content']",
  "dialog[open]",
  ".cl-modalBackdrop",
  ".cl-userButtonPopoverCard",
].join(",");

const CUE_MAX_PX = 28;
const REFRESH_REST_PX = 56;
const EASE = "cubic-bezier(.2,.8,.2,1)";

type Active = {
  start: Point;
  t0: number;
  last: Point;
  lastT: number;
  installed: boolean;
  tabs: { prev: string | null; next: string | null } | null;
  blocked: boolean;
  atTop: boolean;
  overlayOpen: boolean;
  textFocused: boolean;
  kind: GestureKind;
  dead: boolean;
};

function textFocused(): boolean {
  const a = document.activeElement;
  return !!a && a !== document.body && a.matches("input,textarea,select,[contenteditable]:not([contenteditable='false'])");
}

function navigationApi(): { canGoBack?: boolean; canGoForward?: boolean } | undefined {
  return (window as unknown as { navigation?: { canGoBack?: boolean; canGoForward?: boolean } }).navigation;
}

/** Back is possible when the Navigation API says so, else when this tab has more than one entry. Forward only when the API says so (it cannot be known otherwise). */
function canGo(): { back: boolean; forward: boolean } {
  const nav = navigationApi();
  return {
    back: typeof nav?.canGoBack === "boolean" ? nav.canGoBack : window.history.length > 1,
    forward: nav?.canGoForward === true,
  };
}

export function GestureLayer() {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const leftCue = useRef<HTMLDivElement>(null);
  const rightCue = useRef<HTMLDivElement>(null);
  const pull = useRef<HTMLDivElement>(null);
  const pullIcon = useRef<SVGSVGElement>(null);
  const refreshingRef = useRef(false);
  const hidePull = useRef<(() => void) | null>(null);

  // The refresh finished (the server data is back): let the indicator go.
  useEffect(() => {
    const was = refreshingRef.current;
    refreshingRef.current = refreshing;
    if (was && !refreshing) hidePull.current?.();
  }, [refreshing]);

  useEffect(() => {
    const installedAtMount = isInstalledApp();
    const root = document.documentElement;
    const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // In the installed app the page itself must not also pull-to-refresh or bounce (Chrome on Android does it by itself).
    const previousOverscroll = root.style.overscrollBehaviorY;
    if (installedAtMount) root.style.overscrollBehaviorY = "none";

    let g: Active | null = null;
    let pullTimer: ReturnType<typeof setTimeout> | undefined;

    // ---- the two pieces of feedback (fixed, click-through, never in the layout) ----
    const cueFor = (kind: GestureKind) => (kind === "edge-back" ? leftCue.current : kind === "edge-forward" ? rightCue.current : null);

    function showCue(kind: GestureKind, dx: number, y: number) {
      const el = cueFor(kind);
      if (!el) return;
      const p = edgeProgress(dx, window.innerWidth);
      const calm = reduced();
      const w = calm ? 4 : 6 + (CUE_MAX_PX - 6) * p;
      const sign = kind === "edge-back" ? -1 : 1;
      el.style.transition = "none";
      el.style.top = `${Math.max(8, y - 60)}px`;
      el.style.opacity = "1";
      el.style.transform = `translateX(${sign * (CUE_MAX_PX - w)}px)`;
      const arrow = el.firstElementChild as HTMLElement | null;
      if (arrow) arrow.style.opacity = calm ? "0" : String(Math.max(0, (p - 0.4) / 0.6));
    }
    function hideCues() {
      for (const [el, sign] of [[leftCue.current, -1], [rightCue.current, 1]] as const) {
        if (!el) continue;
        const ms = springMs(reduced());
        el.style.transition = ms > 0 ? `transform ${ms}ms ${EASE}, opacity ${ms}ms ${EASE}` : "none";
        el.style.opacity = "0";
        el.style.transform = `translateX(${sign * CUE_MAX_PX}px)`;
      }
    }

    function showPull(travel: number, rotate: number, spinning = false) {
      const el = pull.current;
      if (!el) return;
      el.style.transition = "none";
      el.style.opacity = "1";
      el.style.transform = `translate(-50%, ${travel - 52}px)`;
      if (pullIcon.current) pullIcon.current.style.transform = spinning || reduced() ? "" : `rotate(${rotate}deg)`;
    }
    function hidePullNow() {
      const el = pull.current;
      if (!el) return;
      clearTimeout(pullTimer);
      const ms = springMs(reduced());
      el.style.transition = ms > 0 ? `transform ${ms}ms ${EASE}, opacity ${ms}ms ${EASE}` : "none";
      el.style.opacity = "0";
      el.style.transform = "translate(-50%, -52px)";
    }
    hidePull.current = () => {
      clearTimeout(pullTimer);
      pullTimer = setTimeout(hidePullNow, 250);
    };

    // ---- the touch sequence ----
    const onStart = (e: TouchEvent) => {
      g = null;
      if (e.touches.length !== 1) return;
      const installed = isInstalledApp();
      const target = e.target instanceof Element ? e.target : null;
      const host = target?.closest("[data-tab-prev],[data-tab-next]") ?? null;
      if (!installed && !host) return; // nothing for this touch to become: stay out of the way
      const facts = gestureTargetFacts(target as unknown as TargetLike | null, (el) => getComputedStyle(el as unknown as Element));
      const t = e.touches[0];
      const start = { x: t.clientX, y: t.clientY };
      g = {
        start,
        t0: e.timeStamp,
        last: start,
        lastT: e.timeStamp,
        installed,
        tabs: host ? { prev: host.getAttribute("data-tab-prev"), next: host.getAttribute("data-tab-next") } : null,
        blocked: facts.blocked,
        atTop: facts.atTop && (document.scrollingElement?.scrollTop ?? window.scrollY) <= 0,
        overlayOpen: document.querySelector(OVERLAY_SELECTOR) !== null,
        textFocused: textFocused(),
        kind: "none",
        dead: false,
      };
    };

    const input = (a: Active, current: Point, elapsedMs: number) => {
      const go = canGo();
      return {
        start: a.start,
        current,
        elapsedMs,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        env: {
          touch: true,
          touches: 1,
          installed: a.installed,
          reducedMotion: reduced(),
          blocked: a.blocked,
          overlayOpen: a.overlayOpen,
          textFocused: a.textFocused,
          atTop: a.atTop,
          canGoBack: go.back,
          canGoForward: go.forward,
          tabs: a.tabs ? { prev: a.tabs.prev !== null, next: a.tabs.next !== null } : null,
        },
      };
    };

    const onMove = (e: TouchEvent) => {
      const a = g;
      if (!a || a.dead) return;
      if (e.touches.length !== 1) {
        // A second finger (a pinch): never ours; put the feedback away.
        a.dead = true;
        hideCues();
        if (a.kind === "pull") hidePullNow();
        return;
      }
      const t = e.touches[0];
      a.last = { x: t.clientX, y: t.clientY };
      a.lastT = e.timeStamp;
      if (a.kind === "none") {
        const kind = classifyGesture(input(a, a.last, e.timeStamp - a.t0));
        if (kind === "none") {
          if (pastSlop(a.start, a.last)) a.dead = true; // moved, and it is not a gesture of ours: stop watching
          return;
        }
        a.kind = kind;
      }
      const dx = a.last.x - a.start.x;
      const dy = a.last.y - a.start.y;
      if (a.kind === "edge-back" || a.kind === "edge-forward") {
        if (e.cancelable) e.preventDefault();
        showCue(a.kind, dx, a.last.y);
      } else if (a.kind === "pull") {
        if (e.cancelable) e.preventDefault();
        showPull(pullTravel(dy), Math.min(1, dy / 70) * 270);
      }
    };

    const onEnd = (e: TouchEvent) => {
      const a = g;
      g = null;
      if (!a || a.dead || a.kind === "none") return;
      const t = e.changedTouches[0];
      const current = t ? { x: t.clientX, y: t.clientY } : a.last;
      const gesture = input(a, current, (t ? e.timeStamp : a.lastT) - a.t0);
      const commit = shouldCommit(a.kind, gesture);
      if (a.kind === "edge-back" || a.kind === "edge-forward") {
        hideCues();
        if (commit) {
          if (a.kind === "edge-back") window.history.back();
          else window.history.forward();
        }
      } else if (a.kind === "pull") {
        if (commit) {
          showPull(REFRESH_REST_PX, 0, true);
          startRefresh(() => router.refresh());
          // If the refresh turns out not to be pending (nothing to fetch), do not leave the indicator up.
          clearTimeout(pullTimer);
          pullTimer = setTimeout(() => {
            if (!refreshingRef.current) hidePullNow();
          }, 900);
        } else {
          hidePullNow();
        }
      } else if ((a.kind === "tab-left" || a.kind === "tab-right") && commit && a.tabs) {
        const href = a.kind === "tab-left" ? a.tabs.next : a.tabs.prev;
        if (href) router.push(href);
      }
    };

    const onCancel = () => {
      const a = g;
      g = null;
      if (!a) return;
      hideCues();
      if (a.kind === "pull") hidePullNow();
    };

    // Passive everywhere, except the installed app's one move listener that may cancel an edge swipe or a pull.
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: !installedAtMount });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      clearTimeout(pullTimer);
      hidePull.current = null;
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onCancel);
      root.style.overscrollBehaviorY = previousOverscroll;
    };
  }, [router]);

  const cue = "pointer-events-none fixed z-[60] flex h-[120px] w-7 items-center bg-primary opacity-0";
  return (
    <div data-slot="gesture-layer">
      {/* Edge cues: a thin blue curved edge that follows the finger. Fixed and click-through, so nothing moves. */}
      <div ref={leftCue} aria-hidden className={`${cue} left-0 justify-end rounded-r-[100%]`} style={{ transform: `translateX(-${CUE_MAX_PX}px)` }}>
        <ChevronLeft className="mr-1 size-4 text-primary-foreground opacity-0" strokeWidth={2.5} />
      </div>
      <div ref={rightCue} aria-hidden className={`${cue} right-0 justify-start rounded-l-[100%]`} style={{ transform: `translateX(${CUE_MAX_PX}px)` }}>
        <ChevronRight className="ml-1 size-4 text-primary-foreground opacity-0" strokeWidth={2.5} />
      </div>
      {/* Pull indicator: a small round chip that drops from the top and turns, then spins while the page refreshes. */}
      <div
        ref={pull}
        aria-hidden
        className="pointer-events-none fixed top-[env(safe-area-inset-top)] left-1/2 z-[60] grid size-9 place-items-center rounded-full border border-border bg-popover text-primary opacity-0 shadow-sm"
        style={{ transform: "translate(-50%, -52px)" }}
      >
        <RefreshCw ref={pullIcon} className={`size-[18px] ${refreshing ? "motion-safe:animate-spin" : ""}`} strokeWidth={2} />
      </div>
      <span role="status" className="sr-only">
        {refreshing ? "Refreshing" : ""}
      </span>
    </div>
  );
}
