/**
 * The car render (DESIGN.md, The car; component HubCar): a shaded side view of a sedan on a receding
 * floor grid with a soft blue glow, contact shadows, silver five-spoke wheels with blue hub nodes, a
 * thin blue line along the roof and a light sweep across the body. Decorative: the vehicle's name sits
 * next to it. `idPrefix` keeps gradient ids unique when more than one is on a page.
 */

const PAINTS = {
  graphite: { b0: "#56667F", b1: "#2C384B", b2: "#1A2230", b3: "#0E131B", crease: 0.22 },
  pearl: { b0: "#FFFFFF", b1: "#D9DFE8", b2: "#A9B3C2", b3: "#5D6878", crease: 0.6 },
  blue: { b0: "#7FB0FF", b1: "#3A78E0", b2: "#1D4A99", b3: "#0E2550", crease: 0.3 },
} as const;

export type CarPaint = keyof typeof PAINTS;

const BODY =
  "M26 112 L22 98 C22 88 26 82 34 80 L44 77 L94 72 C108 58 128 46 150 44 L224 44 C238 46 252 58 270 72 L322 80 C334 82 340 88 342 98 L340 112 L300 112 A28 28 0 0 0 244 112 L118 112 A28 28 0 0 0 62 112 Z";
const WHEELS = [90, 272];
const RAYS = Array.from({ length: 13 }, (_, i) => -300 + i * 80);
const ROWS = [141, 147, 155, 166];

function spokes(cx: number) {
  return [0, 72, 144, 216, 288].map((a) => {
    const r = ((a - 90) * Math.PI) / 180;
    return { x: Math.round((cx + Math.cos(r) * 14) * 10) / 10, y: Math.round((114 + Math.sin(r) * 14) * 10) / 10 };
  });
}

export function CarRender({ idPrefix, paint = "graphite", className }: { idPrefix: string; paint?: CarPaint; className?: string }) {
  const p = PAINTS[paint];
  const id = (n: string) => `${idPrefix}-${n}`;
  const url = (n: string) => `url(#${id(n)})`;

  return (
    <svg viewBox="0 0 360 170" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={id("body")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.b0} />
          <stop offset=".38" stopColor={p.b1} />
          <stop offset=".72" stopColor={p.b2} />
          <stop offset="1" stopColor={p.b3} />
        </linearGradient>
        <linearGradient id={id("glass")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3A4E6E" />
          <stop offset="1" stopColor="#0B0F16" />
        </linearGradient>
        <radialGradient id={id("rim")} cx=".42" cy=".38" r=".7">
          <stop offset="0" stopColor="#EEF2F8" />
          <stop offset=".55" stopColor="#8F9BAD" />
          <stop offset="1" stopColor="#3A4558" />
        </radialGradient>
        <radialGradient id={id("tyre")} cx=".5" cy=".5" r=".5">
          <stop offset=".72" stopColor="#0B0E13" />
          <stop offset=".92" stopColor="#1F2733" />
          <stop offset="1" stopColor="#0B0E13" />
        </radialGradient>
        <radialGradient id={id("glow")} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#4388F5" stopOpacity=".38" />
          <stop offset="1" stopColor="#4388F5" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("lamp")} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#DCE8FD" stopOpacity=".9" />
          <stop offset="1" stopColor="#4388F5" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("sweep")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset=".5" stopColor="#FFFFFF" stopOpacity=".22" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <filter id={id("blur")} x="-20%" y="-200%" width="140%" height="500%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <clipPath id={id("floor")}>
          <rect x="0" y="137" width="360" height="33" />
        </clipPath>
        <clipPath id={id("clip")}>
          <path d={BODY} />
        </clipPath>
      </defs>

      <ellipse cx="182" cy="120" rx="190" ry="60" fill={url("glow")} />
      <g clipPath={url("floor")} stroke="var(--raised)" strokeWidth={1}>
        {RAYS.map((x) => (
          <line key={x} x1="180" y1="30" x2={x} y2="170" />
        ))}
        {ROWS.map((y) => (
          <line key={y} x1="0" y1={y} x2="360" y2={y} />
        ))}
      </g>
      <ellipse cx="182" cy="138" rx="160" ry="6" fill="#000" opacity=".85" filter={url("blur")} />
      <path d="M40 137 L330 137" stroke="#4388F5" strokeOpacity=".35" strokeWidth={1} />

      <path d="M62 112 A28 28 0 0 1 118 112 Z" fill="#07090D" />
      <path d="M244 112 A28 28 0 0 1 300 112 Z" fill="#07090D" />

      <path d={BODY} fill={url("body")} />
      <path d="M104 72 C116 60 132 52 152 50 L186 50 L186 72 Z" fill={url("glass")} stroke="#0B0F16" strokeWidth={1} />
      <path d="M194 50 L222 50 C236 52 248 60 260 71 L194 72 Z" fill={url("glass")} stroke="#0B0F16" strokeWidth={1} />
      <path d="M120 70 L140 52 L150 52 L130 70 Z" fill="#fff" opacity=".1" />
      <path d="M202 70 L216 51 L223 51 L209 70 Z" fill="#fff" opacity=".1" />
      <path d="M108 60 C124 49 138 45 150 44 L224 44 C236 45 246 50 258 60" fill="none" stroke="#4388F5" strokeWidth={1.3} opacity=".75" />
      <path d="M40 86 C120 83 240 83 334 88" fill="none" stroke="#fff" strokeOpacity={p.crease} strokeWidth={1.2} />
      <path d="M120 106 L242 106" fill="none" stroke="#000" strokeOpacity=".35" strokeWidth={2} />
      <path d="M118 74 C116 90 116 100 118 110M190 72 L190 110M258 74 C262 86 262 96 258 104" fill="none" stroke="#05070A" strokeOpacity=".55" strokeWidth={1} />
      <rect x="144" y="82" width="14" height="3" rx="1.5" fill="#fff" opacity=".35" />
      <rect x="218" y="82" width="14" height="3" rx="1.5" fill="#fff" opacity=".35" />
      <path d="M256 70 L268 67 L271 74 L258 75 Z" fill={p.b1} stroke="#05070A" strokeOpacity=".5" strokeWidth={0.8} />
      <path d="M314 80 L333 84 C337 86 338 88 338 91 L320 88 Z" fill="#DCE8FD" />
      <ellipse cx="338" cy="88" rx="22" ry="10" fill={url("lamp")} />
      <path d="M23 93 L33 86 L45 84 L41 91 Z" fill="#FF6B61" />
      <ellipse cx="26" cy="90" rx="9" ry="5" fill="#FF6B61" opacity=".35" />
      <path d="M335 100 L342 100 L341 109 L333 109 Z" fill="#05070A" opacity=".8" />
      <g clipPath={url("clip")}>
        <rect x="-90" y="30" width="70" height="90" fill={url("sweep")} transform="skewX(-18)" className="motion-safe:animate-[hub-sweep_6s_ease-in-out_infinite]" />
      </g>

      {WHEELS.map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy="137.5" rx="24" ry="3.2" fill="#000" opacity=".9" filter={url("blur")} />
          <circle cx={cx} cy="114" r="23" fill={url("tyre")} stroke="#2A3445" strokeWidth={1.2} />
          <circle cx={cx} cy="114" r="15.5" fill={url("rim")} />
          <circle cx={cx} cy="114" r="11.5" fill="#141A24" opacity=".75" />
          {spokes(cx).map((s) => (
            <line key={`${s.x}-${s.y}`} x1={cx} y1="114" x2={s.x} y2={s.y} stroke="#C9D2DE" strokeWidth={3.2} strokeLinecap="round" />
          ))}
          <circle cx={cx} cy="114" r="4" fill="#4388F5" stroke="#0B0E13" strokeWidth={1.5} />
        </g>
      ))}
    </svg>
  );
}

/** Vehicle types drawn as the car render; the others (bikes, buses...) keep their icon. */
export const CAR_LIKE_TYPES = new Set(["car", "suv", "van", "pickup", "other"]);
