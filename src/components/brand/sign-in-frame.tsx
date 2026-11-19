import { HubMark } from "@/components/brand/hub-mark";
import { appConfig } from "@/config/app.config";

/** The connected-dots picture behind the brand panel (board HSignIn). */
const DOTS: [number, number][] = [
  [60, 140], [210, 90], [380, 170], [600, 110], [700, 260], [120, 360],
  [560, 400], [90, 620], [300, 760], [520, 700], [690, 820], [420, 560],
];
const LINKS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 11], [4, 6], [6, 11], [5, 7], [7, 8], [8, 9], [9, 10], [9, 11], [2, 11],
];
const FLOWS: [number, number][] = [[1, 2], [7, 8], [4, 6]];

function Lockup({ size }: { size: number }) {
  return (
    <span className="flex items-center gap-3">
      <HubMark size={size} title="" className="text-primary" />
      <span className="flex flex-col">
        <span className="leading-none font-semibold tracking-[-0.06em]" style={{ fontSize: size * 0.78 }}>
          {appConfig.name}
        </span>
      </span>
    </span>
  );
}

/**
 * The frame around Clerk's sign-in and sign-up (R.6; boards HSignIn, HSignInPhone): on desktop a
 * Deepest brand panel on the left (lockup, the big J, "Everything, connected.") and the form card on
 * the right; on a phone the lockup sits above the card. Clerk's own box is styled by clerkAppearance.
 */
export function SignInFrame({ crumb, title, lead, children }: { crumb: string; title: string; lead: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh flex-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section
        aria-label={appConfig.name}
        className="relative hidden flex-col justify-between overflow-hidden bg-deepest p-12 md:flex lg:p-16"
        style={{ backgroundImage: "radial-gradient(var(--card) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
      >
        <svg viewBox="0 0 760 900" preserveAspectRatio="none" aria-hidden className="absolute inset-0 size-full">
          {LINKS.map(([a, b]) => (
            <line key={`${a}-${b}`} x1={DOTS[a][0]} y1={DOTS[a][1]} x2={DOTS[b][0]} y2={DOTS[b][1]} stroke="var(--raised)" strokeWidth={1.5} />
          ))}
          {FLOWS.map(([a, b]) => (
            <line
              key={`f${a}-${b}`}
              x1={DOTS[a][0]}
              y1={DOTS[a][1]}
              x2={DOTS[b][0]}
              y2={DOTS[b][1]}
              stroke="var(--primary)"
              strokeWidth={2}
              strokeDasharray="2 28"
              strokeLinecap="round"
              className="animate-[hub-flow-long_1.6s_linear_infinite]"
            />
          ))}
          {DOTS.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={4} fill="var(--border)" />
          ))}
        </svg>
        <div className="relative">
          <Lockup size={44} />
        </div>
        <div className="relative flex justify-center">
          <HubMark size={300} title="" className="text-primary" />
        </div>
        <div className="relative">
          <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground uppercase">{appConfig.tagline}</p>
          <p className="mt-2.5 max-w-[14ch] font-display text-5xl leading-[1.02] font-semibold tracking-tight">Everything, connected.</p>
        </div>
      </section>

      <section aria-label={title} className="flex flex-col items-center justify-center gap-8 px-4 py-10 md:p-12">
        <div className="flex flex-col items-center gap-2 md:hidden">
          <Lockup size={40} />
          <p className="font-mono text-[10.5px] tracking-[0.3em] text-muted-foreground uppercase">{appConfig.tagline}</p>
        </div>
        <div className="flex w-full max-w-[400px] flex-col gap-5 rounded-3xl border bg-card p-6 md:p-8">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[11px] tracking-[0.14em] text-primary uppercase">/ {crumb}</span>
            <h1 className="text-[2rem] leading-tight font-normal tracking-[-0.03em]">{title}</h1>
            <p className="text-[15px] leading-normal text-muted-foreground">{lead}</p>
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}
