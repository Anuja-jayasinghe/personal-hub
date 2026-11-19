import { describe, expect, it } from "vitest";
import { dialArc, dialPoint, dialTicks, gaugeTop, ringPoint, ringShare } from "./gauge";

const dial = { cx: 100, cy: 100, r: 80, top: 200 };

describe("gaugeTop", () => {
  it("is the high slab plus about a tenth, rounded up to 20", () => {
    expect(gaugeTop(180)).toBe(200);
    expect(gaugeTop(250)).toBe(280);
    expect(gaugeTop(10)).toBe(20);
  });
});

describe("dial geometry", () => {
  it("puts 0 at the lower left, the middle at the top and the end at the lower right", () => {
    expect(dialPoint(dial, 0)).toEqual({ x: 30.7, y: 140 });
    expect(dialPoint(dial, 100)).toEqual({ x: 100, y: 20 });
    expect(dialPoint(dial, 200)).toEqual({ x: 169.3, y: 140 });
    expect(dialPoint(dial, 999)).toEqual(dialPoint(dial, 200));
  });
  it("draws arcs, with the large-arc flag past half the sweep, and nothing for an empty range", () => {
    expect(dialArc(dial, 0, 100)).toBe("M30.7 140 A80 80 0 0 1 100 20");
    expect(dialArc(dial, 0, 200)).toContain(" 0 1 1 ");
    expect(dialArc(dial, 50, 50)).toBe("");
  });
  it("makes one tick per step, ends included", () => {
    expect(dialTicks(dial, 20, 60, 70).match(/M/g)).toHaveLength(11);
  });
});

describe("rings", () => {
  it("measures a share of the top and places points clockwise from the top", () => {
    expect(ringShare(100, 200)).toBe(0.5);
    expect(ringShare(300, 200)).toBe(1);
    expect(ringShare(-5, 200)).toBe(0);
    expect(ringPoint(0, 0, 10, 0)).toEqual({ x: 0, y: -10 });
    expect(ringPoint(0, 0, 10, 0.25)).toEqual({ x: 10, y: 0 });
  });
});
