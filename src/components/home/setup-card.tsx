import Link from "next/link";
import type { setupSteps } from "@/features/home/home";

type Step = ReturnType<typeof setupSteps>[number];

/**
 * First-day setup (board HStates): an empty board waiting for its first meter, then the three steps
 * with the next one highlighted. Shown on Home in place of the electricity card until electricity is
 * counting. Every step opens Electricity, where meters, bills and readings are added.
 */
export function SetupCard({ steps }: { steps: readonly Step[] }) {
  const next = steps.find((s) => !s.done)?.key;
  return (
    <section aria-labelledby="setup-title" className="flex flex-col gap-3">
      <div className="rounded-3xl border border-raised bg-[radial-gradient(100%_90%_at_50%_0%,color-mix(in_oklab,var(--primary)_14%,var(--deepest))_0%,var(--deepest)_62%)] p-4">
        <svg viewBox="0 0 358 170" className="w-full" role="img" aria-label="A grid node with two empty meter slots waiting to be added">
          <path d="M179 30V60H90V100" fill="none" stroke="var(--primary)" strokeWidth={2} />
          <path d="M179 60H268V100" fill="none" stroke="var(--border)" strokeWidth={2} strokeDasharray="5 7" />
          <circle cx="179" cy="26" r="7" fill="var(--primary)" />
          <text x="192" y="30" fontSize={10} letterSpacing={1.4} className="fill-label font-mono">
            GRID
          </text>
          <rect x="40" y="100" width="100" height="62" rx="16" fill="var(--card)" stroke="var(--primary)" strokeWidth={1.6} strokeDasharray="6 5" />
          <text x="90" y="130" textAnchor="middle" fontSize={26} fontWeight={600} className="fill-primary font-display">
            +
          </text>
          <text x="90" y="151" textAnchor="middle" fontSize={9.5} letterSpacing={1.2} className="fill-muted-foreground font-mono">
            METER A
          </text>
          <rect x="218" y="100" width="100" height="62" rx="16" fill="none" stroke="var(--border)" strokeWidth={1.6} strokeDasharray="6 5" />
          <text x="268" y="130" textAnchor="middle" fontSize={26} fontWeight={600} className="fill-quiet font-display">
            +
          </text>
          <text x="268" y="151" textAnchor="middle" fontSize={9.5} letterSpacing={1.2} className="fill-quiet font-mono">
            METER B
          </text>
        </svg>
      </div>
      <p id="setup-title" className="text-[15px] leading-relaxed text-muted-foreground">
        Nothing is connected yet. Three steps and the board lights up.
      </p>
      <ol className="flex flex-col rounded-2xl border bg-card">
        {steps.map((s, i) => {
          const current = s.key === next;
          return (
            <li key={s.key} className={i > 0 ? "border-t border-raised" : ""}>
              <Link href="/electricity" className="flex min-h-16 items-center gap-3 px-4 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold ring-[1.5px] ${
                    s.done ? "bg-status-ok-soft text-status-ok ring-status-ok" : current ? "bg-accent text-foreground ring-primary" : "text-label ring-border"
                  }`}
                >
                  {s.done ? "✓" : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[15px] font-semibold ${s.done ? "text-muted-foreground line-through" : current ? "" : "text-muted-foreground"}`}>{s.title}</span>
                  <span className="block text-xs text-muted-foreground">{s.hint}</span>
                </span>
                {current ? <span className="text-sm font-semibold text-primary">Start</span> : null}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
