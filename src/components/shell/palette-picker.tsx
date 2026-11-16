"use client";

import { Check } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { DEFAULT_PALETTE, PALETTES } from "@/theme/palettes";

const noopSubscribe = () => () => {};

/**
 * Choose a colour palette (DECISIONS C89): four cards, each with its four colours and a short
 * description. The choice is remembered by the browser, per device. Paper & Ink shows as chosen
 * until another one is picked.
 */
export function PalettePicker() {
  const { theme, setTheme } = useTheme();
  // The stored choice is only known on the client; report "not mounted" on the server and during
  // hydration so the first render matches, then switch to the real value.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const current = mounted && theme && PALETTES.some((p) => p.id === theme) ? theme : DEFAULT_PALETTE;

  return (
    <div role="radiogroup" aria-label="Colour palette" className="grid gap-3 sm:grid-cols-2">
      {PALETTES.map((p) => {
        const selected = current === p.id;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(p.id)}
            className={`flex min-h-24 flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
              selected ? "border-primary ring-2 ring-primary" : "hover:border-foreground/40"
            }`}
          >
            <span className="flex w-full items-center gap-1.5">
              {p.swatches.map((c) => (
                <span key={c} aria-hidden className="size-6 rounded-full border border-foreground/25" style={{ background: c }} />
              ))}
              {selected ? <Check className="ml-auto size-4" aria-hidden /> : null}
            </span>
            <span className="text-sm font-medium">{p.label}</span>
            <span className="text-xs text-muted-foreground">{p.description}</span>
          </button>
        );
      })}
    </div>
  );
}
