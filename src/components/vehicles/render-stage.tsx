/**
 * The stage every vehicle render stands on (DESIGN.md, The car): a soft blue glow, a floor grid that
 * recedes to the horizon, a blurred contact shadow and a thin blue ground line. Shared by the sedan and
 * the two-wheelers so they all sit on the same floor. Coordinates are the renders' 360 × 170 view box,
 * with the ground at y = 137.
 */

export const GROUND_Y = 137;
const RAYS = Array.from({ length: 13 }, (_, i) => -300 + i * 80);
const ROWS = [141, 147, 155, 166];

/** Gradients and filters the stage uses; put inside the render's <defs>. */
export function StageDefs({ id }: { id: (name: string) => string }) {
  return (
    <>
      <radialGradient id={id("glow")} cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#4388F5" stopOpacity=".38" />
        <stop offset="1" stopColor="#4388F5" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={id("lamp")} cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#DCE8FD" stopOpacity=".9" />
        <stop offset="1" stopColor="#4388F5" stopOpacity="0" />
      </radialGradient>
      <filter id={id("blur")} x="-20%" y="-200%" width="140%" height="500%">
        <feGaussianBlur stdDeviation="4" />
      </filter>
      <clipPath id={id("floor")}>
        <rect x="0" y={GROUND_Y} width="360" height="33" />
      </clipPath>
    </>
  );
}

/** The glow, floor grid, contact shadow and ground line, under a vehicle `shadowRx` wide around `cx`. */
export function StageFloor({ id, cx = 182, shadowRx = 160 }: { id: (name: string) => string; cx?: number; shadowRx?: number }) {
  const url = (n: string) => `url(#${id(n)})`;
  return (
    <>
      <ellipse cx={cx} cy="120" rx="190" ry="60" fill={url("glow")} />
      <g clipPath={url("floor")} stroke="var(--raised)" strokeWidth={1}>
        {RAYS.map((x) => (
          <line key={x} x1="180" y1="30" x2={x} y2="170" />
        ))}
        {ROWS.map((y) => (
          <line key={y} x1="0" y1={y} x2="360" y2={y} />
        ))}
      </g>
      <ellipse cx={cx} cy={GROUND_Y + 1} rx={shadowRx} ry="6" fill="#000" opacity=".85" filter={url("blur")} />
      <path d={`M${cx - shadowRx * 0.9} ${GROUND_Y} L${cx + shadowRx * 0.92} ${GROUND_Y}`} stroke="#4388F5" strokeOpacity=".35" strokeWidth={1} />
    </>
  );
}
