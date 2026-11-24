/**
 * Touch gestures, as pure decisions (issue #176, DECISIONS C156).
 *
 * The browser already gives back/forward swipes and pull-to-refresh in a normal tab, so the hub only adds
 * them when it is installed on the Home Screen. Everything that decides "is this finger movement a gesture,
 * and which one, and did it go far enough" lives here as plain functions of numbers, so every rule and every
 * threshold is tested without a phone. The thin client pieces (`GestureLayer`, `useSheetDrag`) only read
 * events, ask these functions, and move things.
 *
 * Each gesture is switched off by deleting its one `case` in `classifyGesture` (or its one mount, see C156).
 */

export type Point = { x: number; y: number };

export type GestureKind =
  | "none"
  /** From the left screen edge, to the right: history back (installed app only). */
  | "edge-back"
  /** From the right screen edge, to the left: history forward (installed app only). */
  | "edge-forward"
  /** Down at the very top of the page: refresh (installed app only). */
  | "pull"
  /** A swipe to the left (finger moves left) on a page with tabs: the NEXT tab. */
  | "tab-left"
  /** A swipe to the right: the PREVIOUS tab. */
  | "tab-right"
  /** Down on a bottom sheet's top area: close it. */
  | "sheet-dismiss";

// ---- Thresholds (all in CSS px unless stated) ----
/** A swipe from the edge must START this close to the screen edge. */
export const EDGE_ZONE_PX = 24;
/** An edge swipe commits past this fraction of the screen width ... */
export const EDGE_COMMIT_FRACTION = 0.35;
/** ... or earlier, as a flick: faster than this (px per ms) and at least FLICK_MIN_PX long. */
export const FLICK_SPEED_PX_PER_MS = 0.5;
export const FLICK_MIN_PX = 40;
/** Movement smaller than this decides nothing yet (a tap, a tremor). */
export const INTENT_SLOP_PX = 8;
/** An edge swipe or a pull must be this many times longer on its main axis than on the other. */
export const AXIS_DOMINANCE = 1.5;
/** A downward drag at the top of the page past this (raw finger distance) refreshes. */
export const PULL_THRESHOLD_PX = 70;
/** The indicator can never travel further than this (the rubber band's limit). */
export const PULL_MAX_TRAVEL_PX = 96;
/** A tab swipe must be at least this long ... */
export const TAB_SWIPE_PX = 60;
/** ... and this many times longer sideways than vertically (clearly horizontal). */
export const TAB_DOMINANCE = 2;
/** A bottom sheet closes when dragged down past this, or on a downward flick. */
export const SHEET_CLOSE_PX = 90;
export const SHEET_FLICK_MIN_PX = 30;
/** A drag on a bottom sheet may only START within this many px of the sheet's top (handle and header). */
export const SHEET_HEADER_ZONE_PX = 112;
/** A bottom sheet is a window in the middle of the screen from this viewport width up (Tailwind `md`); no dragging there. */
export const SHEET_DESKTOP_MIN_WIDTH_PX = 768;
/** How long a spring back or a finishing slide takes; 0 under reduced motion (act instantly). */
export const SPRING_MS = 220;

export type GestureEnv = {
  /** The movement comes from a touch screen (touch events), never a mouse or trackpad. */
  touch: boolean;
  /** How many fingers are down; more than one (a pinch) is never a gesture. */
  touches: number;
  /** The hub runs as an installed app (see `isInstalledApp`). Edge swipes and pulls need it. */
  installed: boolean;
  /** `prefers-reduced-motion: reduce`. Does not change WHAT is a gesture, only how it animates (`springMs`). */
  reducedMotion: boolean;
  /** The finger went down on something that owns its own touch (`gestureTargetBlocked`). */
  blocked: boolean;
  /** A dialog, sheet, menu or popover is open: the page gestures stand down. */
  overlayOpen: boolean;
  /** A text field has focus (the keyboard may be up). */
  textFocused: boolean;
  /** The page and every scrolling ancestor of the finger are at their very top. */
  atTop: boolean;
  /** There is a page to go back / forward to. */
  canGoBack: boolean;
  canGoForward: boolean;
  /** The page's neighbouring tabs: null when it has none. */
  tabs: { prev: boolean; next: boolean } | null;
};

export type GestureInput = {
  start: Point;
  current: Point;
  /** Milliseconds since the finger went down. */
  elapsedMs: number;
  viewport: { width: number; height: number };
  env: GestureEnv;
};

/** What a finger that went down at `start` is doing now, for the page-wide gestures. "none" while undecided or rejected. */
export function classifyGesture({ start, current, viewport, env }: GestureInput): GestureKind {
  if (!env.touch || env.touches !== 1 || env.blocked || env.overlayOpen || env.textFocused) return "none";
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < INTENT_SLOP_PX) return "none";

  const inLeftEdge = start.x <= EDGE_ZONE_PX;
  const inRightEdge = start.x >= viewport.width - EDGE_ZONE_PX;

  // The edges belong to back/forward: in the installed app they navigate (when there is somewhere to go) and in a
  // normal tab the browser owns them, so nothing else ever starts there (a tab swipe would fight the browser's own).
  if (inLeftEdge || inRightEdge) {
    if (!env.installed || ax < ay * AXIS_DOMINANCE) return "none";
    if (inLeftEdge && dx > 0 && env.canGoBack) return "edge-back";
    if (inRightEdge && dx < 0 && env.canGoForward) return "edge-forward";
    return "none";
  }

  if (env.installed && env.atTop && dy > 0 && ay >= ax * AXIS_DOMINANCE) return "pull";

  if (env.tabs && ax >= ay * TAB_DOMINANCE) {
    if (dx < 0 && env.tabs.next) return "tab-left";
    if (dx > 0 && env.tabs.prev) return "tab-right";
  }
  return "none";
}

/** Did the finger, lifted now, go far enough to act? `kind` is what `classifyGesture` locked on. */
export function shouldCommit(kind: GestureKind, { start, current, elapsedMs, viewport }: Pick<GestureInput, "start" | "current" | "elapsedMs" | "viewport">): boolean {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const speedX = elapsedMs > 0 ? Math.abs(dx) / elapsedMs : 0;
  const speedY = elapsedMs > 0 ? Math.abs(dy) / elapsedMs : 0;
  switch (kind) {
    case "edge-back":
      return dx > 0 && (dx >= viewport.width * EDGE_COMMIT_FRACTION || (dx >= FLICK_MIN_PX && speedX >= FLICK_SPEED_PX_PER_MS));
    case "edge-forward":
      return dx < 0 && (-dx >= viewport.width * EDGE_COMMIT_FRACTION || (-dx >= FLICK_MIN_PX && speedX >= FLICK_SPEED_PX_PER_MS));
    case "pull":
      return dy > PULL_THRESHOLD_PX;
    case "tab-left":
    case "tab-right":
      // Judged again at the lift: still long enough, still clearly sideways, and still the same direction.
      return Math.abs(dx) >= TAB_SWIPE_PX && Math.abs(dx) >= Math.abs(dy) * TAB_DOMINANCE && (kind === "tab-left" ? dx < 0 : dx > 0);
    case "sheet-dismiss":
      return dy > 0 && (dy >= SHEET_CLOSE_PX || (dy >= SHEET_FLICK_MIN_PX && speedY >= FLICK_SPEED_PX_PER_MS));
    default:
      return false;
  }
}

export type SheetDragEnv = {
  touch: boolean;
  touches: number;
  /** The finger went down in the sheet's top area (handle and header), `SHEET_HEADER_ZONE_PX` from its top. */
  startedInHeader: boolean;
  /** The sheet and every scrolling ancestor of the finger are scrolled to their top. */
  contentAtTop: boolean;
  /** The finger went down on an input, a slider or a `[data-no-gesture]` element. */
  blocked: boolean;
  /** The sheet is the full-width bottom sheet (not the desktop window). */
  bottomSheet: boolean;
};

/** The bottom sheet's own drag: only a mostly vertical, downward movement from its top area. */
export function classifySheetDrag({ start, current, env }: { start: Point; current: Point; env: SheetDragEnv }): GestureKind {
  if (!env.touch || env.touches !== 1 || env.blocked || !env.bottomSheet || !env.startedInHeader || !env.contentAtTop) return "none";
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  if (dy < INTENT_SLOP_PX || dy < Math.abs(dx) * AXIS_DOMINANCE) return "none";
  return "sheet-dismiss";
}

/** Where a drag may start: within `SHEET_HEADER_ZONE_PX` below the sheet's top edge. */
export function startsInSheetHeader(touchY: number, sheetTop: number): boolean {
  const from = touchY - sheetTop;
  return from >= 0 && from <= SHEET_HEADER_ZONE_PX;
}

/** How far the sheet follows the finger: straight down, never up past where it rests. */
export function sheetOffset(dy: number): number {
  return Math.max(0, dy);
}

/** The pull indicator's travel for a finger that has moved `dy` px down: a rubber band (1:1 at first, never past the limit). */
export function pullTravel(dy: number): number {
  if (dy <= 0) return 0;
  return PULL_MAX_TRAVEL_PX * (1 - Math.exp(-dy / PULL_MAX_TRAVEL_PX));
}

/** 0 to 1: how close an edge swipe is to the commit distance (drives the edge cue). */
export function edgeProgress(dx: number, viewportWidth: number): number {
  const need = viewportWidth * EDGE_COMMIT_FRACTION;
  if (need <= 0) return 0;
  return Math.min(1, Math.max(0, Math.abs(dx)) / need);
}

/** How long a spring or a finishing slide lasts: nothing at all when the person asked for less motion. */
export function springMs(reducedMotion: boolean): number {
  return reducedMotion ? 0 : SPRING_MS;
}

/** Has the finger moved enough to have shown its intent? After this, "none" means "not ours": stop watching. */
export function pastSlop(start: Point, current: Point): boolean {
  return Math.max(Math.abs(current.x - start.x), Math.abs(current.y - start.y)) >= INTENT_SLOP_PX;
}

// ---- What the finger went down on (the only part that touches the DOM, written to be testable with plain objects) ----

/** The slice of an element these checks read; a real `Element` fits it. */
export type TargetLike = {
  parentElement: TargetLike | null;
  matches(selector: string): boolean;
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
};

/** Things that own their own touch: text fields, sliders, the odometer chart, a map, anything marked. */
export const OWN_TOUCH_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable]:not([contenteditable='false'])",
  "[role='slider']",
  "[role='spinbutton']",
  "[role='scrollbar']",
  "[data-no-gesture]",
  "iframe",
  "canvas",
  ".leaflet-container",
  ".maplibregl-map",
  ".mapboxgl-map",
].join(",");

type OverflowOf = (el: TargetLike) => { overflowX: string; overflowY: string };

const scrolls = (overflow: string) => overflow === "auto" || overflow === "scroll";

/**
 * Facts about the element a finger went down on. `blocked`: it (or an ancestor) owns its touch or scrolls
 * sideways (`overflow-x: auto|scroll` with room to scroll). `atTop`: every vertically scrolling ancestor, up to
 * and not including `stopAt`, is scrolled to its top. `getOverflow` is `getComputedStyle` in the browser.
 */
export function gestureTargetFacts(target: TargetLike | null, getOverflow: OverflowOf, stopAt: TargetLike | null = null): { blocked: boolean; atTop: boolean } {
  let blocked = false;
  let atTop = true;
  for (let el = target; el && el !== stopAt; el = el.parentElement) {
    if (el.matches(OWN_TOUCH_SELECTOR)) blocked = true;
    const o = getOverflow(el);
    if (scrolls(o.overflowX) && el.scrollWidth > el.clientWidth) blocked = true;
    if (scrolls(o.overflowY) && el.scrollHeight > el.clientHeight && el.scrollTop > 0) atTop = false;
  }
  return { blocked, atTop };
}
