import { describe, expect, it } from "vitest";
import {
  EDGE_COMMIT_FRACTION,
  EDGE_ZONE_PX,
  INTENT_SLOP_PX,
  PULL_MAX_TRAVEL_PX,
  PULL_THRESHOLD_PX,
  SHEET_CLOSE_PX,
  SHEET_HEADER_ZONE_PX,
  SPRING_MS,
  TAB_SWIPE_PX,
  classifyGesture,
  classifySheetDrag,
  edgeProgress,
  gestureTargetFacts,
  pastSlop,
  pullTravel,
  sheetOffset,
  shouldCommit,
  springMs,
  startsInSheetHeader,
  type GestureEnv,
  type GestureInput,
  type SheetDragEnv,
  type TargetLike,
} from "./gestures";

const VIEW = { width: 390, height: 844 };

const baseEnv: GestureEnv = {
  touch: true,
  touches: 1,
  installed: true,
  reducedMotion: false,
  blocked: false,
  overlayOpen: false,
  textFocused: false,
  atTop: true,
  canGoBack: true,
  canGoForward: true,
  tabs: { prev: true, next: true },
};

/** A finger that went down at (sx, sy) and is now at (sx + dx, sy + dy). */
function g(sx: number, sy: number, dx: number, dy: number, env: Partial<GestureEnv> = {}, elapsedMs = 300): GestureInput {
  return { start: { x: sx, y: sy }, current: { x: sx + dx, y: sy + dy }, elapsedMs, viewport: VIEW, env: { ...baseEnv, ...env } };
}

describe("edge swipes (installed app)", () => {
  it("a swipe right from the left edge is back", () => {
    expect(classifyGesture(g(5, 400, 60, 4))).toBe("edge-back");
    expect(classifyGesture(g(EDGE_ZONE_PX, 400, 60, 0))).toBe("edge-back");
  });
  it("a swipe left from the right edge is forward", () => {
    expect(classifyGesture(g(VIEW.width - 5, 400, -60, 4))).toBe("edge-forward");
    expect(classifyGesture(g(VIEW.width - EDGE_ZONE_PX, 400, -60, 0))).toBe("edge-forward");
  });
  it("must start inside the edge zone", () => {
    expect(classifyGesture(g(EDGE_ZONE_PX + 1, 400, 80, 0, { tabs: null }))).toBe("none");
    expect(classifyGesture(g(VIEW.width - EDGE_ZONE_PX - 1, 400, -80, 0, { tabs: null }))).toBe("none");
  });
  it("needs somewhere to go", () => {
    expect(classifyGesture(g(5, 400, 80, 0, { canGoBack: false }))).toBe("none");
    expect(classifyGesture(g(VIEW.width - 5, 400, -80, 0, { canGoForward: false }))).toBe("none");
  });
  it("goes the right way: a swipe out of the left edge to the left is nothing", () => {
    expect(classifyGesture(g(5, 400, -40, 0))).toBe("none");
    expect(classifyGesture(g(VIEW.width - 5, 400, 40, 0))).toBe("none");
  });
  it("must be clearly horizontal", () => {
    expect(classifyGesture(g(5, 400, 40, 40))).toBe("none");
    expect(classifyGesture(g(5, 400, 20, 60))).toBe("none");
  });
  it("is nothing before the movement passes the slop", () => {
    expect(classifyGesture(g(5, 400, INTENT_SLOP_PX - 1, 0))).toBe("none");
    expect(classifyGesture(g(5, 400, INTENT_SLOP_PX, 0))).toBe("edge-back");
  });
  it("does not run in a normal browser tab, and the edge never becomes a tab swipe there either", () => {
    expect(classifyGesture(g(5, 400, 80, 0, { installed: false }))).toBe("none");
    expect(classifyGesture(g(VIEW.width - 5, 400, -80, 0, { installed: false }))).toBe("none");
  });
});

describe("pull to refresh (installed app)", () => {
  it("is a mostly downward drag at the very top", () => {
    expect(classifyGesture(g(200, 100, 5, 40))).toBe("pull");
  });
  it("needs the page (and the scrolling area under the finger) at the top", () => {
    expect(classifyGesture(g(200, 100, 0, 40, { atTop: false }))).toBe("none");
  });
  it("is not an upward drag, nor a sideways one", () => {
    expect(classifyGesture(g(200, 300, 0, -40))).toBe("none");
    expect(classifyGesture(g(200, 100, 40, 40, { tabs: null }))).toBe("none");
  });
  it("does not run in a normal browser tab", () => {
    expect(classifyGesture(g(200, 100, 0, 80, { installed: false }))).toBe("none");
  });
  it("commits only past the threshold of raw finger distance", () => {
    const at = (dy: number) => shouldCommit("pull", g(200, 100, 0, dy));
    expect(at(PULL_THRESHOLD_PX)).toBe(false);
    expect(at(PULL_THRESHOLD_PX + 1)).toBe(true);
    expect(at(30)).toBe(false);
  });
  it("never commits on a flick alone", () => {
    expect(shouldCommit("pull", g(200, 100, 0, 40, {}, 20))).toBe(false);
  });
});

describe("tab swipes (any touch screen)", () => {
  it("a clearly horizontal swipe left is the next tab, right the previous one", () => {
    expect(classifyGesture(g(200, 400, -70, 10, { installed: false }))).toBe("tab-left");
    expect(classifyGesture(g(200, 400, 70, 10, { installed: false }))).toBe("tab-right");
  });
  it("also works in the installed app (away from the edges)", () => {
    expect(classifyGesture(g(200, 400, -70, 10))).toBe("tab-left");
  });
  it("must be more than twice as far sideways as vertical", () => {
    expect(classifyGesture(g(200, 400, -60, 31, { installed: false }))).toBe("none");
    expect(classifyGesture(g(200, 400, -60, 29, { installed: false }))).toBe("tab-left");
  });
  it("needs a neighbour in that direction", () => {
    expect(classifyGesture(g(200, 400, -70, 0, { tabs: { prev: true, next: false } }))).toBe("none");
    expect(classifyGesture(g(200, 400, 70, 0, { tabs: { prev: false, next: true } }))).toBe("none");
    expect(classifyGesture(g(200, 400, 70, 0, { tabs: null }))).toBe("none");
  });
  it("never starts in the edge zone (the browser's own back and forward live there)", () => {
    expect(classifyGesture(g(10, 400, 70, 0, { installed: false }))).toBe("none");
    expect(classifyGesture(g(VIEW.width - 10, 400, -70, 0, { installed: false }))).toBe("none");
  });
  it("commits from TAB_SWIPE_PX, still clearly horizontal, in the same direction", () => {
    expect(shouldCommit("tab-left", g(200, 400, -(TAB_SWIPE_PX - 1), 0))).toBe(false);
    expect(shouldCommit("tab-left", g(200, 400, -TAB_SWIPE_PX, 0))).toBe(true);
    expect(shouldCommit("tab-right", g(200, 400, TAB_SWIPE_PX, 20))).toBe(true);
    expect(shouldCommit("tab-right", g(200, 400, TAB_SWIPE_PX, 40))).toBe(false); // drifted diagonal by the lift
    expect(shouldCommit("tab-left", g(200, 400, TAB_SWIPE_PX, 0))).toBe(false); // came back the other way
  });
});

describe("exclusions that apply to every page gesture", () => {
  const cases: [string, Partial<GestureEnv>][] = [
    ["a mouse or trackpad", { touch: false }],
    ["a second finger (pinch)", { touches: 2 }],
    ["a target that owns its touch", { blocked: true }],
    ["an open dialog, sheet or popover", { overlayOpen: true }],
    ["a focused text field", { textFocused: true }],
  ];
  for (const [name, env] of cases) {
    it(`${name}: nothing, for every gesture`, () => {
      expect(classifyGesture(g(5, 400, 80, 0, env))).toBe("none");
      expect(classifyGesture(g(VIEW.width - 5, 400, -80, 0, env))).toBe("none");
      expect(classifyGesture(g(200, 100, 0, 80, env))).toBe("none");
      expect(classifyGesture(g(200, 400, -80, 0, env))).toBe("none");
    });
  }
});

describe("committing an edge swipe", () => {
  const back = (dx: number, elapsedMs = 400) => shouldCommit("edge-back", g(5, 400, dx, 0, {}, elapsedMs));
  const fwd = (dx: number, elapsedMs = 400) => shouldCommit("edge-forward", g(VIEW.width - 5, 400, dx, 0, {}, elapsedMs));
  const need = VIEW.width * EDGE_COMMIT_FRACTION;
  it("goes past 35% of the width", () => {
    expect(back(need - 1)).toBe(false);
    expect(back(need)).toBe(true);
    expect(fwd(-(need - 1))).toBe(false);
    expect(fwd(-need)).toBe(true);
  });
  it("a fast flick commits early, a slow short drag does not", () => {
    expect(back(60, 100)).toBe(true);
    expect(fwd(-60, 100)).toBe(true);
    expect(back(60, 1000)).toBe(false);
    expect(back(20, 10)).toBe(false); // fast but too short to mean it
  });
  it("a swipe that came back the other way does not commit", () => {
    expect(back(-200, 100)).toBe(false);
    expect(fwd(200, 100)).toBe(false);
  });
  it("a zero elapsed time is not a flick", () => {
    expect(back(60, 0)).toBe(false);
  });
  it("never commits for 'none'", () => {
    expect(shouldCommit("none", g(5, 400, 300, 0))).toBe(false);
  });
});

describe("feedback helpers", () => {
  it("edgeProgress grows to 1 at the commit distance and stays there", () => {
    expect(edgeProgress(0, VIEW.width)).toBe(0);
    expect(edgeProgress(VIEW.width * EDGE_COMMIT_FRACTION, VIEW.width)).toBe(1);
    expect(edgeProgress(-VIEW.width, VIEW.width)).toBe(1);
    expect(edgeProgress(10, 0)).toBe(0);
  });
  it("pullTravel is a rubber band: starts 1:1, always grows, never passes the limit", () => {
    expect(pullTravel(0)).toBe(0);
    expect(pullTravel(-10)).toBe(0);
    expect(pullTravel(5)).toBeCloseTo(5, 0);
    expect(pullTravel(100)).toBeGreaterThan(pullTravel(50));
    expect(pullTravel(1e6)).toBeLessThanOrEqual(PULL_MAX_TRAVEL_PX);
    expect(pullTravel(PULL_THRESHOLD_PX)).toBeLessThan(PULL_THRESHOLD_PX);
  });
  it("reduced motion acts instantly: no spring", () => {
    expect(springMs(true)).toBe(0);
    expect(springMs(false)).toBe(SPRING_MS);
  });
  it("pastSlop tells a tap from a movement", () => {
    expect(pastSlop({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(false);
    expect(pastSlop({ x: 0, y: 0 }, { x: 0, y: INTENT_SLOP_PX })).toBe(true);
  });
  it("reduced motion changes how a gesture animates, never what is one", () => {
    expect(classifyGesture(g(5, 400, 80, 0, { reducedMotion: true }))).toBe("edge-back");
    expect(shouldCommit("edge-back", g(5, 400, 200, 0, { reducedMotion: true }))).toBe(true);
  });
});

describe("the bottom sheet's drag", () => {
  const env: SheetDragEnv = { touch: true, touches: 1, startedInHeader: true, contentAtTop: true, blocked: false, bottomSheet: true };
  const drag = (dx: number, dy: number, e: Partial<SheetDragEnv> = {}) => classifySheetDrag({ start: { x: 100, y: 500 }, current: { x: 100 + dx, y: 500 + dy }, env: { ...env, ...e } });

  it("is a downward drag from the top area", () => {
    expect(drag(0, 30)).toBe("sheet-dismiss");
    expect(drag(8, 30)).toBe("sheet-dismiss");
  });
  it("is nothing for sideways, upward or tiny movement", () => {
    expect(drag(40, 30)).toBe("none");
    expect(drag(0, -40)).toBe("none");
    expect(drag(0, INTENT_SLOP_PX - 1)).toBe("none");
  });
  it("never starts below the header, or in scrolled content", () => {
    expect(drag(0, 60, { startedInHeader: false })).toBe("none");
    expect(drag(0, 60, { contentAtTop: false })).toBe("none");
  });
  it("never on an input or slider, with a second finger, by mouse, or on the desktop window", () => {
    expect(drag(0, 60, { blocked: true })).toBe("none");
    expect(drag(0, 60, { touches: 2 })).toBe("none");
    expect(drag(0, 60, { touch: false })).toBe("none");
    expect(drag(0, 60, { bottomSheet: false })).toBe("none");
  });
  it("the header zone starts at the sheet's top edge and ends SHEET_HEADER_ZONE_PX below", () => {
    expect(startsInSheetHeader(300, 300)).toBe(true);
    expect(startsInSheetHeader(300 + SHEET_HEADER_ZONE_PX, 300)).toBe(true);
    expect(startsInSheetHeader(300 + SHEET_HEADER_ZONE_PX + 1, 300)).toBe(false);
    expect(startsInSheetHeader(299, 300)).toBe(false);
  });
  it("closes past SHEET_CLOSE_PX or on a downward flick, otherwise springs back", () => {
    const close = (dy: number, ms = 400) => shouldCommit("sheet-dismiss", { start: { x: 0, y: 0 }, current: { x: 0, y: dy }, elapsedMs: ms, viewport: VIEW });
    expect(close(SHEET_CLOSE_PX - 1)).toBe(false);
    expect(close(SHEET_CLOSE_PX)).toBe(true);
    expect(close(45, 60)).toBe(true); // flick
    expect(close(45, 600)).toBe(false); // slow and short
    expect(close(10, 5)).toBe(false); // fast but tiny
    expect(close(-120, 50)).toBe(false); // upward
  });
  it("follows the finger down, never up past rest", () => {
    expect(sheetOffset(42)).toBe(42);
    expect(sheetOffset(-30)).toBe(0);
  });
});

/** A fake element tree for the target facts (the real check reads getComputedStyle, injected here). */
function el(opts: { selectors?: string[]; ox?: string; oy?: string; sw?: number; cw?: number; sh?: number; ch?: number; top?: number; parent?: TargetLike | null } = {}): TargetLike & { ox: string; oy: string } {
  return {
    parentElement: opts.parent ?? null,
    matches: (s: string) => (opts.selectors ?? []).some((x) => s.split(",").includes(x)),
    scrollWidth: opts.sw ?? 100,
    clientWidth: opts.cw ?? 100,
    scrollHeight: opts.sh ?? 100,
    clientHeight: opts.ch ?? 100,
    scrollTop: opts.top ?? 0,
    ox: opts.ox ?? "visible",
    oy: opts.oy ?? "visible",
  };
}
const overflowOf = (e: TargetLike) => {
  const x = e as ReturnType<typeof el>;
  return { overflowX: x.ox, overflowY: x.oy };
};

describe("what the finger went down on", () => {
  it("a plain element is free", () => {
    expect(gestureTargetFacts(el({ parent: el() }), overflowOf)).toEqual({ blocked: false, atTop: true });
  });
  it("inputs, textareas, selects, sliders, contenteditable, the chart and [data-no-gesture] own their touch", () => {
    for (const s of ["input", "textarea", "select", "[role='slider']", "[data-no-gesture]", "[contenteditable]:not([contenteditable='false'])"]) {
      expect(gestureTargetFacts(el({ selectors: [s] }), overflowOf).blocked, s).toBe(true);
    }
  });
  it("counts an owner higher up the tree (the chart's svg inside a [data-no-gesture] figure)", () => {
    const figure = el({ selectors: ["[data-no-gesture]"] });
    expect(gestureTargetFacts(el({ parent: figure }), overflowOf).blocked).toBe(true);
  });
  it("a sideways-scrolling strip is blocked only when it really scrolls", () => {
    const strip = el({ ox: "auto", sw: 600, cw: 300 });
    expect(gestureTargetFacts(el({ parent: strip }), overflowOf).blocked).toBe(true);
    const fits = el({ ox: "auto", sw: 300, cw: 300 });
    expect(gestureTargetFacts(el({ parent: fits }), overflowOf).blocked).toBe(false);
    const clipped = el({ ox: "hidden", sw: 600, cw: 300 });
    expect(gestureTargetFacts(el({ parent: clipped }), overflowOf).blocked).toBe(false);
  });
  it("is not at the top inside a scrolled vertical scroller, and is at its top otherwise", () => {
    const scrolled = el({ oy: "auto", sh: 900, ch: 300, top: 120 });
    expect(gestureTargetFacts(el({ parent: scrolled }), overflowOf).atTop).toBe(false);
    const atTop = el({ oy: "scroll", sh: 900, ch: 300, top: 0 });
    expect(gestureTargetFacts(el({ parent: atTop }), overflowOf).atTop).toBe(true);
  });
  it("stops at stopAt (the sheet), ignoring what lies above it", () => {
    const page = el({ ox: "auto", sw: 900, cw: 300, oy: "auto", sh: 900, ch: 300, top: 50 });
    const sheet = el({ parent: page });
    expect(gestureTargetFacts(el({ parent: sheet }), overflowOf, page)).toEqual({ blocked: false, atTop: true });
  });
  it("a null target is free", () => {
    expect(gestureTargetFacts(null, overflowOf)).toEqual({ blocked: false, atTop: true });
  });
});
