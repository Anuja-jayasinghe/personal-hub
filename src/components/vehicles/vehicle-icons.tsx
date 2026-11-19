/**
 * The vehicle-type icons (S.6, C112; design board "New vehicle and Settings icons"): the hub's own line
 * icons on a 24 px grid, stroke 1.7, with wheels drawn as rings around a small hub node. They replace
 * the lucide set, which did not match the other icons. Names are the `icon` values in
 * `appConfig.vehicles.types`; add one here when a new type needs it.
 */
type Def = { d: string; rings: [number, number, number][]; nodes?: [number, number][] };

const LOW = "M8.8 15.5h6.4M2.5 15.5h1.7M19.8 15.5h1.7";
const FOUR_WHEELS: [number, number, number][] = [
  [6.5, 15.8, 2.3],
  [17.5, 15.8, 2.3],
];

const defs: Record<string, Def> = {
  car: {
    d: `M2.5 15.5v-2.3c0-.8.5-1.4 1.2-1.6l3-.9 2.6-2.9c.4-.4.9-.7 1.5-.7h4.6c.6 0 1.2.3 1.6.8l2.2 2.8 1.9.4c.8.2 1.4.9 1.4 1.7v2.7M9.6 10.7h7.6${LOW}`,
    rings: FOUR_WHEELS,
  },
  suv: { d: `M2.5 15.5v-4c0-.6.4-1 1-1h1.8l2.2-3.6c.2-.3.5-.4.8-.4h8.4c.4 0 .7.2.9.5l2 3.5h.9c.6 0 1 .4 1 1v4M8 5h8${LOW}`, rings: FOUR_WHEELS },
  van: { d: `M2.5 15.5V8c0-.6.4-1 1-1h11.3c.3 0 .6.1.8.4l3.9 4.1 1.6.6c.5.2.9.7.9 1.2v2.2M15 7.6v3.9h4.2${LOW}`, rings: FOUR_WHEELS },
  truck: { d: `M2.5 15.5V11H12V7.5c0-.3.2-.5.5-.5h4.3c.4 0 .7.2.9.5l2.3 3.5 1.4.5c.4.1.6.5.6.9v3.1M12 11h7.5${LOW}`, rings: FOUR_WHEELS },
  motorbike: {
    d: "M5.5 16l3.6-5.5h4.8l1.9 3M9.1 10.5 8 8H5.5M13.9 10.5l2.1-3.2h2.1M15.8 13.5l2.7 2.5",
    rings: [
      [5.5, 16, 3],
      [18.5, 16, 3],
    ],
    nodes: [[18.2, 7.3]],
  },
  scooter: {
    d: "M6 17h8.5c0-3.3 1-5.5 3-6.5l-1-4.5h2.4M8.4 17c.2-2.2 1.6-3.5 4-3.5h3",
    rings: [
      [6, 17, 2.4],
      [18, 17, 2.4],
    ],
    nodes: [[18.9, 6]],
  },
  bicycle: {
    d: "M5.5 15.5l4-7h6l3 7M9.5 8.5l2.5 7H5.5M15.5 8.5l-.8-2.3h2.2M8.2 6.2h2.6",
    rings: [
      [5.5, 15.5, 3.4],
      [18.5, 15.5, 3.4],
    ],
    nodes: [[12, 15.5]],
  },
  "three-wheeler": {
    d: "M3.5 16V9.5c0-2.2 1.8-4 4-4H15l3.5 5V16M3.5 12.5h15M10.5 5.5v7M9 16h6",
    rings: [
      [6.5, 16.6, 2],
      [17.5, 16.6, 2],
    ],
  },
  bus: {
    d: "M4 16.5V5.5C4 4.7 4.7 4 5.5 4h13c.8 0 1.5.7 1.5 1.5v11zM4 11h16M9 4v7M15 4v7",
    rings: [
      [7.5, 18.3, 1.7],
      [16.5, 18.3, 1.7],
    ],
  },
};

/** The icon for a vehicle type's icon name; the car for anything unknown or when no type is set. */
export function VehicleTypeIcon({ name, className }: { name: string | undefined; className?: string }) {
  const def = defs[name ?? ""] ?? defs.car;
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={def.d} />
      {def.rings.map(([x, y, r]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r={r} />
          <circle cx={x} cy={y} r={0.95} fill="currentColor" stroke="none" />
        </g>
      ))}
      {def.nodes?.map(([x, y]) => (
        <circle key={`n-${x}-${y}`} cx={x} cy={y} r={1.9} fill="currentColor" stroke="none" />
      ))}
    </svg>
  );
}
