"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  SHEET_DESKTOP_MIN_WIDTH_PX,
  classifySheetDrag,
  gestureTargetFacts,
  pastSlop,
  sheetOffset,
  shouldCommit,
  springMs,
  startsInSheetHeader,
  type Point,
  type TargetLike,
} from "@/lib/gestures";

const EASE = "cubic-bezier(.2,.8,.2,1)";

/**
 * Swipe down to close a bottom sheet (issue #176, C156). Returns a callback ref for the sheet's popup element.
 *
 * Only a finger that goes down in the sheet's top area (the handle and the header, `SHEET_HEADER_ZONE_PX`) and
 * moves mostly down starts it; the sheet then follows the finger, and on lift it closes (past
 * `SHEET_CLOSE_PX` or on a downward flick) or springs back. Anything else is left alone, so the sheet's own
 * scrolling and its fields work as before: a finger on an input or a slider, content scrolled away from the
 * top, a second finger. `preventDefault` is called only once the drag has started, on a `touchmove` listener
 * that is non-passive for exactly that reason. `close` must go through the dialog's own close (so focus and
 * scroll lock are handled); it is only ever called on a committed drag.
 */
export function useSheetDrag(enabled: boolean, close: () => void): (el: HTMLElement | null) => void {
  const closeRef = useRef(close);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    closeRef.current = close;
    enabledRef.current = enabled;
  });
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);

  return useCallback((el: HTMLElement | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!el) return;

    let start: Point | null = null;
    let last: Point | null = null;
    let t0 = 0;
    let lastTime = 0;
    let startedInHeader = false;
    let contentAtTop = false;
    let blocked = false;
    let locked = false;
    let dead = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bottomSheet = () => window.innerWidth < SHEET_DESKTOP_MIN_WIDTH_PX;

    function settle(transform: string) {
      const ms = springMs(reduced());
      el!.style.transition = ms > 0 ? `transform ${ms}ms ${EASE}` : "none";
      el!.style.transform = transform;
    }
    function springBack() {
      settle("");
      const ms = springMs(reduced());
      clearTimeout(timer);
      timer = setTimeout(() => {
        el!.style.transition = "";
        el!.style.transform = "";
      }, ms);
    }

    const onStart = (e: TouchEvent) => {
      clearTimeout(timer);
      locked = false;
      dead = false;
      start = null;
      if (!enabledRef.current || e.touches.length !== 1 || !bottomSheet()) {
        dead = true;
        return;
      }
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY };
      last = start;
      t0 = e.timeStamp;
      lastTime = t0;
      startedInHeader = startsInSheetHeader(t.clientY, el!.getBoundingClientRect().top);
      const facts = gestureTargetFacts(e.target as unknown as TargetLike | null, (x) => getComputedStyle(x as unknown as Element), el!.parentElement as unknown as TargetLike | null);
      blocked = facts.blocked;
      contentAtTop = facts.atTop;
    };

    const onMove = (e: TouchEvent) => {
      if (!start || dead) return;
      if (e.touches.length !== 1) {
        // A second finger (a pinch): give up, and put the sheet back if it was moving.
        dead = true;
        if (locked) springBack();
        return;
      }
      const t = e.touches[0];
      last = { x: t.clientX, y: t.clientY };
      lastTime = e.timeStamp;
      if (!locked) {
        const kind = classifySheetDrag({ start, current: last, env: { touch: true, touches: 1, startedInHeader, contentAtTop, blocked, bottomSheet: bottomSheet() } });
        if (kind !== "sheet-dismiss") {
          // Moved enough to show it is something else (a scroll, a sideways move): not ours, stop watching.
          if (pastSlop(start, last)) dead = true;
          return;
        }
        locked = true;
        el!.style.transition = "none";
      }
      if (e.cancelable) e.preventDefault();
      el!.style.transform = `translateY(${sheetOffset(last.y - start.y)}px)`;
    };

    const onEnd = () => {
      if (!start || !locked || dead) {
        start = null;
        return;
      }
      const s = start;
      const l = last ?? s;
      start = null;
      locked = false;
      const commit = shouldCommit("sheet-dismiss", { start: s, current: l, elapsedMs: lastTime - t0, viewport: { width: window.innerWidth, height: window.innerHeight } });
      if (!commit) {
        springBack();
        return;
      }
      settle(`translateY(${el!.offsetHeight}px)`);
      closeRef.current();
      // If the sheet did not close after all (something kept it open), bring it back instead of leaving it half off screen.
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (el!.isConnected && el!.hasAttribute("data-open")) springBack();
      }, 600);
    };

    const onCancel = () => {
      const was = locked;
      start = null;
      locked = false;
      if (was) springBack();
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onCancel, { passive: true });
    cleanup.current = () => {
      clearTimeout(timer);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
  }, []);
}
