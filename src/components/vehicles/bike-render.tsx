import type { ReactNode } from "react";
import { GROUND_Y, StageDefs, StageFloor } from "@/components/vehicles/render-stage";
import type { BikeKind, BikePaint } from "@/features/vehicles/vehicle-look";

/**
 * Two-wheeler renders (issue #172), in the same language as the car render: a shaded side view on the
 * stage, silver wheels with blue hub nodes, a headlamp glow and a light sweep. Each kind is drawn in
 * millimetres from a real model (rear axle at x = 0, ground at y = 0, front to the right) and scaled
 * onto the stage:
 * - superbike: BMW S 1000 RR / Yamaha YZF-R1M (wheelbase 1,430, height 1,140): full fairing, tall tail,
 *   short exhaust; the Motorsport paint adds BMW's side gills, the carbon paint the R1M's silver tank.
 * - supermoto: Aprilia Dorsoduro 1200 (1,528 / 1,205): tall, a beak screen, trellis frame, V-twin,
 *   twin silencers under the tail, curved swingarm.
 * - commuter: Bajaj Discover 125M (1,255 / 1,044): headlamp cowl, flat seat, single cylinder, upswept
 *   silencer, twin shocks, thin-spoke wheels.
 * - scooter: Honda Dio 110 (1,238 / 1,133): front apron with the lamp, floorboard, body over the
 *   engine, 10-inch wheels.
 * Decorative: the vehicle's name sits next to it. `idPrefix` keeps gradient ids unique on a page.
 */

type Stops = readonly [string, string, string, string];
type Paint = { body: Stops; tank?: Stops; trim: string; stripe?: string; carbon?: boolean };

const PAINTS: Record<BikePaint, Paint> = {
  graphite: { body: ["#56667F", "#2C384B", "#1A2230", "#0E131B"], trim: "#4388F5" },
  black: { body: ["#3A4352", "#1A1F28", "#0E1218", "#07090D"], trim: "#4388F5" },
  red: { body: ["#FF8A80", "#E0392F", "#A31D16", "#5E0F0B"], trim: "#FFFFFF" },
  motorsport: { body: ["#FFFFFF", "#E3E8EF", "#B6C0CE", "#6B7686"], tank: ["#7FB0FF", "#2F6FD8", "#1D4A99", "#0E2550"], trim: "#2F6FD8", stripe: "#E5383B" },
  carbon: { body: ["#3B4350", "#222831", "#161B22", "#0B0E13"], tank: ["#F4F7FB", "#C9D1DC", "#8A95A5", "#4C5666"], trim: "#2F6FD8", carbon: true },
};

type Geometry = {
  /** Millimetres to view-box units. */
  scale: number;
  /** Rear and front wheels: axle x, tyre radius, rim radius, spokes, a front brake disc. */
  wheels: readonly { x: number; r: number; rim: number; spokes: number; split?: boolean; disc?: boolean }[];
  /** Left and right ends of the vehicle, for centring and the shadow. */
  span: readonly [number, number];
  /** Headlamp and tail lamp positions, for the glows. */
  lamp: readonly [number, number];
  tail: readonly [number, number];
};

const GEOMETRY: Record<BikeKind | "scooter", Geometry> = {
  superbike: { scale: 0.104, wheels: [{ x: 0, r: 315, rim: 218, spokes: 5, split: true }, { x: 1430, r: 300, rim: 218, spokes: 5, split: true, disc: true }], span: [-315, 1730], lamp: [1515, -945], tail: [-290, -1000] },
  supermoto: { scale: 0.099, wheels: [{ x: 0, r: 315, rim: 218, spokes: 3, split: true }, { x: 1528, r: 305, rim: 218, spokes: 3, split: true, disc: true }], span: [-315, 1833], lamp: [1345, -955], tail: [-265, -1005] },
  commuter: { scale: 0.111, wheels: [{ x: 0, r: 292, rim: 216, spokes: 10 }, { x: 1255, r: 286, rim: 216, spokes: 10, disc: true }], span: [-230, 1541], lamp: [1172, -860], tail: [-205, -800] },
  scooter: { scale: 0.104, wheels: [{ x: 0, r: 217, rim: 127, spokes: 5 }, { x: 1238, r: 217, rim: 127, spokes: 5 }], span: [-250, 1455], lamp: [1360, -760], tail: [-238, -650] },
};

export function BikeRender({ idPrefix, kind, paint = "graphite", className }: { idPrefix: string; kind: BikeKind | "scooter"; paint?: BikePaint; className?: string }) {
  const p = PAINTS[paint];
  const g = GEOMETRY[kind];
  const id = (n: string) => `${idPrefix}-${n}`;
  const url = (n: string) => `url(#${id(n)})`;
  const cx = 180;
  const offset = cx - ((g.span[0] + g.span[1]) / 2) * g.scale;
  const shadowRx = ((g.span[1] - g.span[0]) / 2) * g.scale * 0.95;
  const parts = { superbike: Superbike, supermoto: Supermoto, commuter: Commuter, scooter: Scooter }[kind];
  const transform = `translate(${Math.round(offset * 100) / 100} ${GROUND_Y}) scale(${g.scale})`;

  return (
    <svg viewBox="0 0 360 170" className={className} aria-hidden focusable="false">
      <defs>
        <StageDefs id={id} />
        <Gradient id={id("body")} stops={p.body} />
        <Gradient id={id("tank")} stops={p.tank ?? p.body} />
        <linearGradient id={id("dark")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2A3342" />
          <stop offset="1" stopColor="#0B0E13" />
        </linearGradient>
        <linearGradient id={id("metal")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EEF2F8" />
          <stop offset=".5" stopColor="#9AA6B8" />
          <stop offset="1" stopColor="#4A5568" />
        </linearGradient>
        <linearGradient id={id("glass")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3A4E6E" />
          <stop offset="1" stopColor="#0B0F16" />
        </linearGradient>
        <radialGradient id={id("tyre")} cx=".5" cy=".5" r=".5">
          <stop offset=".72" stopColor="#0B0E13" />
          <stop offset=".92" stopColor="#1F2733" />
          <stop offset="1" stopColor="#0B0E13" />
        </radialGradient>
        <linearGradient id={id("sweep")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset=".5" stopColor="#FFFFFF" stopOpacity=".2" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        {p.carbon ? (
          <pattern id={id("weave")} width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="40" height="40" fill="#1B2028" />
            <rect width="20" height="20" fill="#252B35" />
            <rect x="20" y="20" width="20" height="20" fill="#252B35" />
          </pattern>
        ) : null}
        <clipPath id={id("panels")}>
          {PANELS[kind].map((d) => (
            <path key={d} d={d} transform={transform} />
          ))}
        </clipPath>
      </defs>

      <StageFloor id={id} cx={cx} shadowRx={shadowRx} />

      <g transform={transform}>
        {g.wheels.map((w) => (
          <ellipse key={`s${w.x}`} cx={w.x} cy={8} rx={w.r * 1.05} ry={30} fill="#000" opacity=".9" filter={url("blur")} />
        ))}
        {parts({ url, p, back: true })}
        {g.wheels.map((w) => (
          <Wheel key={w.x} url={url} {...w} />
        ))}
        {parts({ url, p, back: false })}
        <ellipse cx={g.lamp[0] + 40} cy={g.lamp[1]} rx={150} ry={70} fill={url("lamp")} />
        <ellipse cx={g.tail[0]} cy={g.tail[1]} rx={70} ry={40} fill="#FF6B61" opacity=".35" />
      </g>
      <g clipPath={url("panels")}>
        <rect x="-90" y="10" width="70" height="130" fill={url("sweep")} transform="skewX(-18)" className="motion-safe:animate-[hub-sweep_6s_ease-in-out_infinite]" />
      </g>
    </svg>
  );
}

function Gradient({ id, stops }: { id: string; stops: Stops }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={stops[0]} />
      <stop offset=".38" stopColor={stops[1]} />
      <stop offset=".72" stopColor={stops[2]} />
      <stop offset="1" stopColor={stops[3]} />
    </linearGradient>
  );
}

function Wheel({ url, x, r, rim, spokes, split, disc }: { url: (n: string) => string; x: number; r: number; rim: number; spokes: number; split?: boolean; disc?: boolean }) {
  const cy = -r;
  const rays = Array.from({ length: spokes }, (_, i) => (i * 360) / spokes - 90).flatMap((a) => (split ? [a - 6, a + 6] : [a]));
  const at = (a: number, d: number) => {
    const rad = (a * Math.PI) / 180;
    return { x: Math.round((x + Math.cos(rad) * d) * 10) / 10, y: Math.round((cy + Math.sin(rad) * d) * 10) / 10 };
  };
  return (
    <g>
      <circle cx={x} cy={cy} r={r} fill={url("tyre")} stroke="#2A3445" strokeWidth={12} />
      <circle cx={x} cy={cy} r={rim} fill="#141A24" stroke="#8F9BAD" strokeWidth={10} />
      {disc ? <circle cx={x} cy={cy} r={rim * 0.72} fill="none" stroke="#B9C3D1" strokeWidth={22} strokeDasharray="10 14" opacity=".9" /> : null}
      {rays.map((a) => {
        const end = at(a, rim - 6);
        return <line key={a} x1={x} y1={cy} x2={end.x} y2={end.y} stroke="#C9D2DE" strokeWidth={spokes > 6 ? 9 : 22} strokeLinecap="round" />;
      })}
      <circle cx={x} cy={cy} r={Math.max(34, rim * 0.22)} fill="#4388F5" stroke="#0B0E13" strokeWidth={12} />
    </g>
  );
}

const SUPERBIKE_FAIRING =
  "M880 -985 L1395 -1050 C1460 -1012 1510 -972 1538 -930 L1522 -880 C1440 -820 1360 -720 1300 -640 C1230 -560 1150 -440 1110 -300 L1080 -176 L560 -160 C486 -186 444 -238 432 -300 L470 -560 C520 -704 600 -800 704 -830 Z";
const SUPERBIKE_TANK =
  "M398 -822 L420 -852 C520 -962 652 -1032 782 -1022 L900 -988 L918 -812 C760 -830 560 -836 398 -822 Z";
const SUPERBIKE_TAIL =
  "M-300 -1004 L-60 -930 L330 -846 L430 -826 L430 -744 L250 -732 C100 -762 -100 -852 -300 -1004 Z";
const SUPERMOTO_TANK =
  "M760 -880 L830 -1002 L1052 -1046 L1186 -994 L1156 -880 L900 -832 Z";
const SUPERMOTO_TAIL =
  "M-230 -996 L300 -896 L430 -882 L430 -800 L300 -790 C150 -810 0 -880 -230 -996 Z";
const COMMUTER_TANK =
  "M600 -800 C650 -900 782 -942 900 -932 L1002 -882 L982 -762 L640 -742 Z";
const SCOOTER_BODY =
  "M-232 -620 C-180 -720 -60 -762 150 -752 L700 -738 C650 -604 560 -500 480 -338 L430 -330 L100 -330 C-50 -400 -180 -520 -232 -620 Z";
const SCOOTER_APRON =
  "M1150 -930 L1290 -960 C1350 -860 1400 -700 1410 -520 L1380 -440 C1330 -420 1280 -440 1250 -470 L1196 -330 L1120 -330 C1110 -560 1120 -760 1150 -930 Z";

/** The painted panels of each kind; the light sweep is clipped to them. */
const PANELS: Record<BikeKind | "scooter", readonly string[]> = {
  superbike: [SUPERBIKE_FAIRING, SUPERBIKE_TANK, SUPERBIKE_TAIL],
  supermoto: [SUPERMOTO_TANK, SUPERMOTO_TAIL],
  commuter: [COMMUTER_TANK],
  scooter: [SCOOTER_BODY, SCOOTER_APRON],
};

type PartsProps = { url: (n: string) => string; p: Paint; back: boolean };

function Superbike({ url, p, back }: PartsProps): ReactNode {
  if (back) {
    return (
      <>
        {/* Frame and engine showing between the fairing and the tail. */}
        <path d="M250 -760 L520 -840 L560 -540 L470 -280 L300 -330 Z" fill={url("dark")} />
        {/* Swingarm, pivot to rear axle. */}
        <path d="M560 -540 L590 -420 L30 -262 L-20 -360 Z" fill={url("metal")} opacity=".85" />
        <path d="M560 -540 L590 -420 L30 -262 L-20 -360 Z" fill="#141A24" opacity=".45" />
        {/* Fork legs, clamp to front axle. */}
        <path d="M1255 -700 L1310 -690 L1458 -300 L1402 -300 Z" fill={p.carbon ? "#D9A62E" : url("metal")} />
      </>
    );
  }
  return (
    <>
      {/* Exhaust: BMW's short silencer angles up beside the rear wheel; the R1's sits low under the engine. */}
      {p.carbon ? (
        <path d="M600 -150 L330 -188 C300 -230 300 -300 330 -330 L560 -320 Z" fill={url("dark")} stroke="#5A6577" strokeWidth={10} />
      ) : (
        <>
          <path d="M480 -322 L534 -404 L214 -652 L146 -566 Z" fill={url("metal")} />
          <ellipse cx={180} cy={-610} rx={36} ry={58} transform="rotate(-38 180 -610)" fill="#0B0E13" />
        </>
      )}
      <path d={SUPERBIKE_TAIL} fill={url("body")} />
      <path d="M-40 -926 C80 -884 220 -856 334 -846 L334 -818 C204 -830 64 -858 -40 -904 Z" fill="#0B0E13" />
      {p.stripe ? <path d="M-280 -985 L330 -840 L330 -812 L-250 -950 Z" fill={p.stripe} opacity=".9" /> : null}
      <path d={SUPERBIKE_TANK} fill={url("tank")} />
      {/* Windscreen. */}
      <path d="M930 -1000 L1060 -1150 L1130 -1160 L1398 -1052 Z" fill={url("glass")} stroke="#0B0F16" strokeWidth={8} />
      <path d={SUPERBIKE_FAIRING} fill={p.carbon ? url("weave") : url("body")} />
      {p.carbon ? <path d={SUPERBIKE_FAIRING} fill={url("body")} opacity=".55" /> : null}
      {p.tank && !p.carbon ? <path d="M1138 -262 L1088 -176 L560 -160 C486 -186 444 -238 432 -300 L452 -420 C700 -400 960 -380 1196 -404 Z" fill={url("tank")} /> : null}
      {p.stripe ? <path d="M520 -700 L1330 -690 L1300 -640 L500 -650 Z" fill={p.stripe} opacity=".95" /> : null}
      <path d="M900 -990 C1080 -1010 1260 -1030 1395 -1050" fill="none" stroke={p.trim} strokeWidth={14} opacity=".85" />
      <path d="M1500 -900 C1300 -860 1000 -820 640 -800" fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth={10} />
      {p.carbon ? (
        <path d="M800 -560 L1080 -600 L1010 -470 L760 -440 Z" fill="#0B0E13" stroke={p.trim} strokeWidth={12} />
      ) : (
        <g stroke="#0B0E13" strokeWidth={26} strokeLinecap="round" opacity=".8">
          <line x1="980" y1="-560" x2="1060" y2="-760" />
          <line x1="1050" y1="-560" x2="1130" y2="-760" />
          <line x1="1120" y1="-560" x2="1200" y2="-760" />
        </g>
      )}
      {/* Front mudguard, headlamp slit, tail lamp. */}
      <path d="M1270 -560 C1380 -640 1560 -620 1660 -500 L1630 -490 C1540 -590 1390 -600 1290 -540 Z" fill={url("body")} />
      <path d="M1440 -975 L1528 -940 L1520 -918 L1450 -948 Z" fill="#DCE8FD" />
      <path d="M-300 -1004 L-250 -990 L-262 -966 Z" fill="#FF6B61" />
    </>
  );
}

function Supermoto({ url, p, back }: PartsProps): ReactNode {
  if (back) {
    return (
      <>
        {/* Curved swingarm and the V-twin. */}
        <path d="M660 -520 C460 -560 210 -430 24 -352 L-12 -282 C200 -330 456 -420 660 -420 Z" fill={url("metal")} />
        <path d="M520 -560 L1080 -600 L1110 -260 L860 -210 L560 -250 Z" fill={url("dark")} />
        <path d="M640 -560 L760 -860 L900 -820 L800 -540 Z" fill="#1A2230" stroke="#3A4558" strokeWidth={10} />
        <path d="M900 -470 L1150 -720 L1220 -620 L990 -400 Z" fill="#1A2230" stroke="#3A4558" strokeWidth={10} />
        <g stroke="#3A4558" strokeWidth={8}>
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={i} x1={660 + i * 26} y1={-620 - i * 50} x2={800 + i * 22} y2={-590 - i * 48} />
          ))}
        </g>
        {/* Upside-down fork. */}
        <path d="M1190 -930 L1252 -920 L1418 -480 L1356 -480 Z" fill="#141A24" />
        <path d="M1356 -480 L1406 -480 L1556 -300 L1500 -300 Z" fill={url("metal")} />
      </>
    );
  }
  return (
    <>
      {/* Header pipe under the engine and up to the twin silencers tucked under the tail. */}
      <path d="M1000 -430 C900 -240 600 -230 520 -300 C460 -360 420 -560 400 -760" fill="none" stroke="#7C8796" strokeWidth={24} strokeLinecap="round" />
      <path d="M300 -884 L760 -884 L700 -580 L430 -640 Z" fill="#141A24" />
      <path d="M-120 -945 L380 -800 L390 -712 L-100 -860 Z" fill={url("metal")} />
      <circle cx={-110} cy={-922} r={30} fill="#0B0E13" />
      <circle cx={-100} cy={-874} r={30} fill="#0B0E13" />
      <path d={SUPERMOTO_TAIL} fill={url("body")} />
      <path d="M300 -884 L812 -910 L830 -872 L320 -848 Z" fill="#0B0E13" />
      <path d={SUPERMOTO_TANK} fill={url("tank")} />
      {/* Red trellis frame on its aluminium pivot plate. */}
      <g stroke="#C8473D" strokeWidth={22} strokeLinecap="round" fill="none">
        <path d="M1180 -872 L700 -800 M1150 -770 L680 -580 M1180 -872 L1150 -770 M1060 -856 L1000 -700 M940 -838 L880 -660 M820 -818 L770 -620 M700 -800 L680 -580" />
      </g>
      <path d="M580 -470 L720 -500 L740 -780 L620 -780 Z" fill={url("metal")} opacity=".55" />
      <path d="M1046 -900 L1192 -962 L1156 -660 L1004 -700 Z" fill={url("body")} />
      <path d="M820 -998 L1052 -1042" fill="none" stroke={p.trim} strokeWidth={14} opacity=".85" />
      {/* Bars, the beak screen around the lamp, the low mudguard. */}
      <path d="M1196 -1010 L1150 -1130 L1050 -1150" fill="none" stroke="#C9D2DE" strokeWidth={24} strokeLinecap="round" />
      <path d="M1236 -1012 L1330 -1068 L1356 -1000 L1316 -884 L1240 -900 Z" fill={url("body")} />
      <path d="M1250 -1020 L1330 -1068 L1344 -1030 L1262 -990 Z" fill={url("glass")} />
      <path d="M1338 -980 L1360 -930 L1336 -896 L1322 -948 Z" fill="#DCE8FD" />
      <path d="M1360 -600 C1460 -660 1620 -640 1720 -540 L1690 -526 C1600 -610 1470 -620 1380 -572 Z" fill={url("body")} />
      <path d="M-270 -1008 L-226 -994 L-238 -972 Z" fill="#FF6B61" />
    </>
  );
}

function Commuter({ url, p, back }: PartsProps): ReactNode {
  if (back) {
    return (
      <>
        {/* Swingarm, engine, frame down tube, fork. */}
        <path d="M470 -380 L486 -330 L14 -268 L-2 -318 Z" fill="#141A24" />
        <path d="M980 -780 L880 -320 L700 -240" fill="none" stroke="#1A2230" strokeWidth={40} />
        <path d="M440 -500 L770 -560 L830 -300 L530 -250 L430 -330 Z" fill={url("metal")} opacity=".9" />
        <path d="M700 -560 L900 -640 L966 -500 L770 -420 Z" fill="#1A2230" />
        <g stroke="#566275" strokeWidth={10}>
          {[0, 1, 2, 3].map((i) => (
            <line key={i} x1={716 + i * 16} y1={-580 + i * 40} x2={910 + i * 16} y2={-658 + i * 40} />
          ))}
        </g>
        <path d="M960 -880 L1010 -880 L1180 -540 L1130 -540 Z" fill="#C9D2DE" />
        <path d="M1130 -540 L1180 -540 L1272 -290 L1230 -290 Z" fill={url("metal")} />
        {/* Twin shocks. */}
        <path d="M20 -320 L110 -770" stroke="#0B0E13" strokeWidth={36} />
        <path d="M30 -380 L100 -720" stroke="#C9D2DE" strokeWidth={22} strokeDasharray="14 12" />
      </>
    );
  }
  return (
    <>
      {/* Upswept silencer with its heat shield. */}
      <path d="M900 -500 C880 -360 850 -260 620 -244 L470 -270" fill="none" stroke="#9AA6B8" strokeWidth={28} />
      <path d="M480 -258 L480 -364 L-60 -476 L-92 -384 Z" fill={url("metal")} />
      <path d="M420 -352 L180 -404 L190 -440 L420 -390 Z" fill="#0B0E13" opacity=".7" />
      {/* Side panel, seat, tail with grab rail and lamp, number-plate hanger. */}
      <path d="M248 -760 L604 -760 L562 -600 L330 -618 Z" fill={url("body")} />
      <path d="M-182 -820 L142 -790 L152 -758 L-152 -780 Z" fill={url("body")} />
      <path d="M-200 -560 L-170 -560 L-150 -770 L-180 -770 Z" fill="#1A2230" />
      <path d="M118 -790 L620 -802 L642 -770 L140 -760 C118 -768 112 -780 118 -790 Z" fill="#0B0E13" />
      <path d="M-120 -840 L260 -812" fill="none" stroke="#C9D2DE" strokeWidth={16} strokeLinecap="round" />
      <path d={COMMUTER_TANK} fill={url("body")} />
      <path d="M860 -760 L992 -782 L960 -640 L840 -652 Z" fill={url("body")} />
      <path d="M640 -820 C700 -880 800 -900 900 -892" fill="none" stroke={p.trim} strokeWidth={18} opacity=".85" />
      {/* Bars and mirror, the headlamp cowl, front mudguard. */}
      <path d="M970 -950 L860 -1000" fill="none" stroke="#C9D2DE" strokeWidth={22} strokeLinecap="round" />
      <path d="M930 -975 L890 -1090" fill="none" stroke="#566275" strokeWidth={12} />
      <ellipse cx={884} cy={-1110} rx={44} ry={26} fill="#1A2230" stroke="#566275" strokeWidth={8} />
      <path d="M1036 -932 L1130 -952 L1172 -880 L1150 -790 L1060 -782 Z" fill={url("body")} />
      <path d="M1150 -900 L1176 -870 L1160 -820 L1140 -860 Z" fill="#DCE8FD" />
      <path d="M1080 -500 C1160 -590 1340 -590 1420 -470 L1390 -460 C1320 -560 1180 -560 1100 -480 Z" fill={url("body")} />
      <path d="M-205 -810 L-180 -800 L-182 -782 L-206 -790 Z" fill="#FF6B61" />
    </>
  );
}

function Scooter({ url, p, back }: PartsProps): ReactNode {
  if (back) {
    return (
      <>
        {/* Engine and drive unit, front fork. */}
        <path d="M-60 -330 L480 -330 L480 -246 L250 -150 L0 -160 Z" fill={url("dark")} />
        <path d="M1206 -470 L1250 -470 L1258 -217 L1218 -217 Z" fill={url("metal")} />
      </>
    );
  }
  return (
    <>
      <path d="M-200 -262 L150 -300 L170 -200 L-180 -150 Z" fill={url("metal")} />
      <ellipse cx={-190} cy={-206} rx={22} ry={48} fill="#0B0E13" />
      <path d={SCOOTER_BODY} fill={url("body")} />
      <path d="M-120 -560 C40 -620 300 -640 560 -600" fill="none" stroke={p.trim} strokeWidth={16} opacity=".8" />
      <path d="M120 -770 C300 -800 520 -792 704 -760 L690 -730 L130 -736 Z" fill="#0B0E13" />
      <path d="M-170 -772 L300 -796" fill="none" stroke="#C9D2DE" strokeWidth={16} strokeLinecap="round" />
      <path d="M440 -330 L1200 -330 L1206 -288 L430 -288 Z" fill="#1A2230" />
      <path d={SCOOTER_APRON} fill={url("body")} />
      <path d="M1160 -900 C1150 -700 1150 -520 1160 -340" fill="none" stroke="#000" strokeOpacity=".35" strokeWidth={14} />
      {/* Handlebar cover and mirror, the lamp on the apron, front mudguard, tail lamp. */}
      <path d="M1080 -1000 L1300 -1022 L1330 -962 L1100 -934 Z" fill={url("body")} />
      <path d="M1160 -1006 L1130 -1120" fill="none" stroke="#566275" strokeWidth={12} />
      <ellipse cx={1124} cy={-1138} rx={42} ry={24} fill="#1A2230" stroke="#566275" strokeWidth={8} />
      <path d="M1300 -820 L1352 -744 L1340 -700 L1296 -770 Z" fill="#DCE8FD" />
      <path d="M1030 -300 C1090 -480 1390 -490 1450 -300 L1414 -292 C1360 -440 1124 -440 1066 -292 Z" fill={url("body")} />
      <path d="M-236 -664 L-206 -640 L-226 -620 L-246 -640 Z" fill="#FF6B61" />
    </>
  );
}
