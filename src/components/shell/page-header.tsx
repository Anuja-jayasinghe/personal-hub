import { Logo } from "@/components/brand/logo";

/**
 * A page's title row. On a phone the J mark sits before the title, since there is no top bar
 * (the rail carries it on desktop). Titles are Oxanium (DESIGN.md, Typography).
 */
export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="flex items-start gap-3">
      <span className="pt-0.5 md:hidden">
        <Logo size={30} decorative />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
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
