/**
 * The drawings on the odd-state screens (R.6; boards H404Desktop, HSystem, HStates), in the hub's
 * node-and-line language. Only the current along the working lines moves; it stops under reduced motion.
 */

const N = { hub: [230, 230], el: [110, 110], bi: [380, 120], ve: [90, 340], re: [250, 420], loose: [330, 330] } as const;
type Key = keyof typeof N;
const seg = (a: Key, b: Key) => ({ x1: N[a][0], y1: N[a][1], x2: N[b][0], y2: N[b][1] });

const NODES = [
  { key: "hub", r: 16, fill: "var(--primary)", label: "HUB", ty: 266 },
  { key: "el", r: 9, fill: "var(--muted-foreground)", label: "ELECTRICITY", ty: 92 },
  { key: "bi", r: 9, fill: "var(--muted-foreground)", label: "BILLS", ty: 102 },
  { key: "ve", r: 9, fill: "var(--muted-foreground)", label: "VEHICLES", ty: 370 },
  { key: "re", r: 9, fill: "var(--muted-foreground)", label: "REMINDERS", ty: 450 },
  { key: "loose", r: 7, fill: "var(--label)", label: "", ty: 0 },
] as const;

/** 404: the hub's network, with one line running off to a node that connects to nothing. */
export function NotFoundNetwork({ className = "" }: { className?: string }) {
  const links = [seg("hub", "el"), seg("hub", "bi"), seg("hub", "ve"), seg("hub", "re"), seg("hub", "loose"), seg("el", "bi"), seg("ve", "re")];
  const flows = [seg("hub", "el"), seg("hub", "bi"), seg("hub", "ve")];
  return (
    <svg viewBox="0 0 520 520" className={className} role="img" aria-label="The hub's network of nodes, with one line ending in a node that connects to nothing">
      {links.map((l, i) => (
        <line key={`l${i}`} {...l} stroke="var(--border)" strokeWidth={2} />
      ))}
      {flows.map((l, i) => (
        <line
          key={`f${i}`}
          {...l}
          stroke="var(--primary)"
          strokeWidth={2.4}
          strokeDasharray="2 28"
          strokeLinecap="round"
          className="animate-[hub-flow-long_1.4s_linear_infinite]"
        />
      ))}
      {NODES.map((n) => (
        <g key={n.key}>
          <circle cx={N[n.key][0]} cy={N[n.key][1]} r={n.r} fill={n.fill} stroke="var(--background)" strokeWidth={3} />
          {n.label ? (
            <text x={N[n.key][0]} y={n.ty} textAnchor="middle" fontSize={11} letterSpacing={1.4} fill="var(--label)" className="font-mono">
              {n.label}
            </text>
          ) : null}
        </g>
      ))}
      <path d="M330 330 L420 420" fill="none" stroke="var(--quiet)" strokeWidth={2.5} strokeDasharray="6 8" />
      <circle cx={420} cy={420} r={34} fill="var(--background)" stroke="var(--quiet)" strokeWidth={2.5} strokeDasharray="6 6" />
      <text x={420} y={434} textAnchor="middle" fontSize={40} fontWeight={600} fill="var(--label)" className="font-display">
        ?
      </text>
    </svg>
  );
}

/** "Lost the connection": a blue line from the hub, broken in the middle, the far end grey. */
export function BrokenLink({ className = "" }: { className?: string }) {
  return (
    <svg width={240} height={90} viewBox="0 0 240 90" className={className} role="img" aria-label="A line between the hub and its data, broken in the middle">
      <line x1={20} y1={45} x2={108} y2={45} stroke="var(--primary)" strokeWidth={3} strokeLinecap="round" />
      <line x1={140} y1={45} x2={220} y2={45} stroke="var(--quiet)" strokeWidth={3} strokeLinecap="round" />
      <circle cx={220} cy={45} r={9} fill="var(--deepest)" stroke="var(--quiet)" strokeWidth={3} />
      <circle cx={20} cy={45} r={9} fill="var(--primary)" />
      <circle cx={108} cy={45} r={5} fill="var(--status-overdue)" />
      <path d="M118 34l4-10M124 40l10-6M118 56l6 10" stroke="var(--status-soon)" strokeWidth={2.4} strokeLinecap="round" />
      <text x={20} y={80} textAnchor="middle" fontSize={9} letterSpacing={1} fill="var(--label)" className="font-mono">
        HUB
      </text>
      <text x={220} y={80} textAnchor="middle" fontSize={9} letterSpacing={1} fill="var(--label)" className="font-mono">
        DATA
      </text>
    </svg>
  );
}
