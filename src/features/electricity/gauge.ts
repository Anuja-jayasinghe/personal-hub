/**
 * Geometry for the meter instrument and Home's usage rings (S.4, C109; design board "Electricity: the
 * meter instrument"). Pure. Values are whole units; the scale runs from 0 to `gaugeTop(high)`.
 */

/** The top of the dial: the high slab plus about a tenth, rounded up to 20 (180 gives 200). */
export function gaugeTop(high: number): number {
  return Math.max(20, Math.ceil(high / 0.9 / 20) * 20);
}

/** The dial sweeps 240 degrees, starting at the lower left (150 degrees, y pointing down). */
const START = 150;
const SWEEP = 240;

export type Dial = { cx: number; cy: number; r: number; top: number };

function angle(dial: Dial, value: number): number {
  const v = Math.min(dial.top, Math.max(0, value));
  return ((START + (v / dial.top) * SWEEP) * Math.PI) / 180;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A point on the dial at `value`, `radius` from the centre. */
export function dialPoint(dial: Dial, value: number, radius = dial.r): { x: number; y: number } {
  const a = angle(dial, value);
  return { x: r1(dial.cx + radius * Math.cos(a)), y: r1(dial.cy + radius * Math.sin(a)) };
}

/** The SVG path of the dial's arc from `from` to `to` at `radius`; empty when there is nothing to draw. */
export function dialArc(dial: Dial, from: number, to: number, radius = dial.r): string {
  const a = Math.min(dial.top, Math.max(0, from));
  const b = Math.min(dial.top, Math.max(0, to));
  if (b - a <= 0) return "";
  const p = dialPoint(dial, a, radius);
  const q = dialPoint(dial, b, radius);
  const large = ((b - a) / dial.top) * SWEEP > 180 ? 1 : 0;
  return `M${p.x} ${p.y} A${radius} ${radius} 0 ${large} 1 ${q.x} ${q.y}`;
}

/** Tick marks every `step` units, as one path, between `inner` and `outer` radius. */
export function dialTicks(dial: Dial, step: number, inner: number, outer: number): string {
  let d = "";
  for (let v = 0; v <= dial.top; v += step) {
    const a = dialPoint(dial, v, inner);
    const b = dialPoint(dial, v, outer);
    d += `M${a.x} ${a.y}L${b.x} ${b.y}`;
  }
  return d;
}

/** Share of a full ring for Home's rings (once round = the dial top), from 0 to 1. */
export function ringShare(value: number, top: number): number {
  if (top <= 0 || value <= 0) return 0;
  return Math.min(1, value / top);
}

/** A point on a full ring that starts at the top and goes clockwise, at `share` of the way round. */
export function ringPoint(cx: number, cy: number, radius: number, share: number): { x: number; y: number } {
  const a = share * 2 * Math.PI - Math.PI / 2;
  return { x: r1(cx + radius * Math.cos(a)), y: r1(cy + radius * Math.sin(a)) };
}
