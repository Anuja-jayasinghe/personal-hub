import Link from "next/link";
import { Logo } from "@/components/brand/logo";

/**
 * A page's title row. On a phone the J mark sits before the title, since there is no top bar
 * (the rail carries it on desktop). Titles are Oxanium (DESIGN.md, Typography).
 * `parent` adds the mono breadcrumb above the title on a sub-page ("/ Settings /"), linking back.
 */
export function PageHeader({
  title,
  description,
  parent,
}: {
  title: string;
  description?: string;
  parent?: { href: string; label: string };
}) {
  return (
    <header className="flex items-start gap-3">
      <span className="pt-0.5 md:hidden">
        <Logo size={30} decorative />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        {parent ? (
          <p className="font-mono text-[11px] tracking-[0.12em] text-label uppercase">
            /{" "}
            <Link href={parent.href} className="rounded-sm outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">
              {parent.label}
            </Link>{" "}
            /
          </p>
        ) : null}
        <h1 className="font-display text-[1.75rem] leading-none font-semibold tracking-tight md:text-4xl">{title}</h1>
        {description ? <p className="text-muted-foreground">{description}</p> : null}
      </div>
    </header>
  );
}

/** Friendly placeholder shown where real data will appear. */
export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
