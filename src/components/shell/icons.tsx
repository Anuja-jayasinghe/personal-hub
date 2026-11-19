/**
 * The hub's own icon set (DESIGN.md, Icons): line icons on a 24px grid whose key ends carry a small
 * node, echoing the J mark. They take the current text colour.
 *
 * App config refers to icons by name (`icon: "zap"`); getIcon() turns a name into a component.
 * Add a name here when a new module needs one.
 */
/** A path, filled nodes (r 1.9 unless `nodeR`), and optional rings: wheels drawn as a circle with a hub dot (S.6). */
type NodeIconDef = { d: string; nodes: [number, number][]; nodeR?: number; rings?: [number, number, number][] };

const defs = {
  home: { d: "M4 11l8-7 8 7M6 9.5V20h12V9.5", nodes: [[12, 4], [4, 11], [20, 11]] },
  // S.6 (C112): a sedan side view, wheels as rings with a hub node (design board "New vehicle and Settings icons").
  car: {
    d: "M2.5 15.5v-2.3c0-.8.5-1.4 1.2-1.6l3-.9 2.6-2.9c.4-.4.9-.7 1.5-.7h4.6c.6 0 1.2.3 1.6.8l2.2 2.8 1.9.4c.8.2 1.4.9 1.4 1.7v2.7M9.6 10.7h7.6M8.8 15.5h6.4M2.5 15.5h1.7M19.8 15.5h1.7",
    nodes: [],
    rings: [[6.5, 15.8, 2.3], [17.5, 15.8, 2.3]],
  },
  zap: { d: "M13 3L6 13h6l-1 8 7-10h-6z", nodes: [[13, 3], [11, 21]] },
  receipt: { d: "M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21zM10 8h4M10 12h4", nodes: [[7, 3], [17, 3]] },
  bell: { d: "M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4", nodes: [[12, 5]] },
  tasks: { d: "M4 7l2 2 3.5-3.5M4 16l2 2 3.5-3.5M13 7.5h7M13 16.5h7", nodes: [[20, 7.5], [20, 16.5]] },
  notes: { d: "M5 4h14v11l-5 5H5zM14 20v-5h5", nodes: [[5, 4], [19, 4]] },
  documents: { d: "M6 3h8l4 4v14H6zM14 3v4h4", nodes: [[14, 3], [18, 7]] },
  shield: { d: "M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z", nodes: [[12, 3], [5, 6], [19, 6]] },
  // S.6 (C112): three sliders whose knobs are the hub's nodes, instead of the crosshair.
  settings: { d: "M4 6.5h16M4 12h16M4 17.5h16", nodes: [[9, 6.5], [15.5, 12], [7, 17.5]], nodeR: 2.3 },
  more: { d: "M5 12h14", nodes: [[5, 12], [12, 12], [19, 12]] },
  signout: { d: "M10 5H5v14h5M14 8l4 4-4 4M18 12H9", nodes: [[5, 5], [5, 19]] },
  help: { d: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7", nodes: [[12, 17]] },
} satisfies Record<string, NodeIconDef>;

export type IconName = keyof typeof defs;

export type IconProps = { className?: string; strokeWidth?: number };
export type IconComponent = (props: IconProps) => React.ReactElement;

function make(def: NodeIconDef): IconComponent {
  function NodeIcon({ className, strokeWidth = 1.7 }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={24}
        height={24}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className ?? "size-5"}
        aria-hidden="true"
        focusable="false"
      >
        <path d={def.d} />
        {def.rings?.map(([x, y, r]) => (
          <g key={`ring-${x}-${y}`}>
            <circle cx={x} cy={y} r={r} />
            <circle cx={x} cy={y} r={0.95} fill="currentColor" stroke="none" />
          </g>
        ))}
        {def.nodes.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={def.nodeR ?? 1.9} fill="currentColor" stroke="none" />
        ))}
      </svg>
    );
  }
  return NodeIcon;
}

const components = Object.fromEntries(Object.entries(defs).map(([name, def]) => [name, make(def)])) as Record<IconName, IconComponent>;

/** The icon for a name from app.config.ts; an unknown name gets the help icon. */
export function getIcon(name: string): IconComponent {
  return (components as Record<string, IconComponent>)[name] ?? components.help;
}
