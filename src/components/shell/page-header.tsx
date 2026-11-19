import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { AccountMenu } from "@/components/shell/account-menu";

/** The J mark on a phone (the rail carries it on desktop), linking to Home (S.1). */
export function PhoneMark() {
  return (
    <Link href="/" aria-label="hub, go to Home" className="shrink-0 rounded-md pt-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden">
      <Logo size={30} decorative />
    </Link>
  );
}

/** Your profile circle, at the top right of every app page (S.1, owner's list items 9 and 10). */
export function HeaderAccount() {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center">
      <AccountMenu />
    </span>
  );
}

/**
 * A page's title row: the J mark on a phone, the title in Oxanium (DESIGN.md, Typography), the page's
 * own buttons, and your profile circle at the far right, in the same place on every page.
 * `parent` adds the mono breadcrumb above the title on a sub-page ("/ Settings /"), linking back.
 */
export function PageHeader({
  title,
  description,
  parent,
  actions,
}: {
  title: string;
  description?: string;
  parent?: { href: string; label: string };
  /** Buttons for this page (e.g. "Add vehicle"), shown before the profile circle. */
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex items-start gap-3">
      <PhoneMark />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {parent ? <Crumb parent={parent} /> : null}
        <h1 className="font-display text-[1.75rem] leading-none font-semibold tracking-tight md:text-4xl">{title}</h1>
        {description ? <p className="text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      <HeaderAccount />
    </header>
  );
}

function Crumb({ parent }: { parent: { href: string; label: string } }) {
  return (
    <p className="font-mono text-[11px] tracking-[0.12em] text-label uppercase">
      /{" "}
      <Link href={parent.href} className="rounded-sm outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">
        {parent.label}
      </Link>{" "}
      /
    </p>
  );
}

/** The row above a page that draws its own title (the vehicle page): the J mark, a breadcrumb back, the profile. */
export function PageTopBar({ parent }: { parent: { href: string; label: string } }) {
  return (
    <div className="flex items-center gap-3">
      <PhoneMark />
      <div className="min-w-0 flex-1">
        <Crumb parent={parent} />
      </div>
      <HeaderAccount />
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
