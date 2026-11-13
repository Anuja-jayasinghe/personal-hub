"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const noopSubscribe = () => () => {};

const options = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

/** Light / dark / follow-system switch (DECISIONS C31). The choice is remembered by the browser. */
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
    <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-2">
      {options.map(({ value, label, Icon }) => {
        const selected = mounted && theme === value;
        return (
          <Button
            key={value}
            role="radio"
            aria-checked={selected}
            variant={selected ? "default" : "outline"}
            onClick={() => setTheme(value)}
          >
            <Icon aria-hidden /> {label}
          </Button>
        );
      })}
    </div>
  );
}
