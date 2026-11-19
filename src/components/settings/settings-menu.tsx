"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SETTINGS_PAGES } from "./settings-ui";

/** The 224px sub-menu beside the Settings pages on desktop (DESIGN.md, Layout). Phones use the list on /settings. */
export function SettingsMenu() {
  const pathname = usePathname();
  return <SettingsMenuLinks pathname={pathname} />;
}

export function SettingsMenuLinks({ pathname }: { pathname: string | null }) {
  return (
    <ul className="flex flex-col gap-1">
      {SETTINGS_PAGES.map((p) => {
        const current = pathname === p.href;
        return (
          <li key={p.href}>
            <Link
              href={p.href}
              aria-current={current ? "page" : undefined}
              className={`flex min-h-10 items-center rounded-lg border px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                current ? "border-primary/50 bg-accent text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
