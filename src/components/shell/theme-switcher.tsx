"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** A tiny picture of the app in each look (board HSettings): page, a panel, a line with a blue node. */
const looks = {
  dark: { bg: "#11151D", edge: "#303B4B", panel: "#1A2230", track: "#303B4B", blue: "#4388F5" },
  light: { bg: "#ECF0F5", edge: "#D5DBE4", panel: "#FFFFFF", track: "#D5DBE4", blue: "#2869D8" },
} as const;

const options = [
  { value: "dark", label: "Dark", halves: ["dark"] },
  { value: "light", label: "Light", halves: ["light"] },
  { value: "system", label: "Follow phone", halves: ["dark", "light"] },
] as const;

function Preview({ look }: { look: (typeof looks)[keyof typeof looks] }) {
  return (
    <span className="flex h-full flex-1 flex-col gap-1.5 p-2" style={{ background: look.bg }}>
      <span className="h-5 rounded-[5px]" style={{ background: look.panel, boxShadow: `inset 0 0 0 1px ${look.edge}` }} />
      <span className="relative mt-auto h-0.5 rounded-full" style={{ background: look.track }}>
        <span className="absolute inset-y-0 left-0 w-1/2 rounded-full" style={{ background: look.blue }} />
        <span className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: look.blue }} />
      </span>
    </span>
  );
}

/** Dark / Light / Follow phone (DECISIONS C31, C92; board HSettings). The choice is remembered by the browser. */
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  // The stored theme is only known on the client; report "not mounted" on the server and during
  // hydration so the first render matches, then switch to the real value.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  return (
    <div role="radiogroup" aria-label="Look" className="grid grid-cols-3 gap-2.5">
      {options.map(({ value, label, halves }) => {
        const selected = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(value)}
            className={`flex flex-col gap-2 rounded-xl border bg-card p-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              selected ? "border-primary ring-1 ring-primary" : "hover:border-primary/50"
            }`}
          >
            <span aria-hidden className="flex h-16 overflow-hidden rounded-lg border">
              {halves.map((h) => (
                <Preview key={h} look={looks[h]} />
              ))}
            </span>
            <span className="flex items-center gap-2 px-0.5 text-[13px] font-semibold">
              <span
                aria-hidden
                className={`flex size-4 items-center justify-center rounded-full border ${selected ? "border-primary" : "border-quiet"}`}
              >
                {selected ? <span className="size-2 rounded-full bg-primary" /> : null}
              </span>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
