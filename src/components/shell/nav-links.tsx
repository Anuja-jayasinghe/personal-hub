import Link from "next/link";
import { getIcon } from "@/components/shell/icons";
import { isCurrent, type NavItem } from "@/components/shell/nav";
import { cn } from "@/lib/utils";

/**
 * The links of the phone bar and the desktop rail (DESIGN.md, Navigation). Pure markup: the current
 * page comes in as `pathname`, so the same links render as a fallback (nothing current) while the
 * real path is read on the client.
 */
export function NavLinks({ items, pathname, variant }: { items: NavItem[]; pathname: string | null; variant: "bar" | "rail" }) {
  return items.map((item) => {
    const Icon = getIcon(item.icon);
    const current = pathname !== null && isCurrent(item, pathname);

    // Desktop rail: icons only (S.1). The name is the link's accessible name and shows as a small label
    // beside the icon on hover or keyboard focus, so it is not printed twice on screen.
    if (variant === "rail") {
      return (
        <Link
          key={item.key}
          href={item.href}
          aria-label={item.label}
          aria-current={current ? "page" : undefined}
          className={cn(
            "group relative flex size-12 items-center justify-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
            current ? "bg-accent text-primary ring-1 ring-primary/45" : "text-label hover:bg-raised/70 hover:text-foreground",
          )}
        >
          <Icon className="size-[22px]" />
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-full z-40 ml-3 -translate-y-1/2 rounded-lg border bg-popover px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-popover-foreground opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            {item.label}
          </span>
        </Link>
      );
    }

    return (
      <Link
        key={item.key}
        href={item.href}
        aria-current={current ? "page" : undefined}
        className={cn(
          "group flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl py-1 text-[10.5px] leading-none outline-none focus-visible:ring-2 focus-visible:ring-ring",
          current ? "font-semibold text-foreground" : "font-medium text-label hover:text-foreground",
        )}
      >
        <span className={cn("flex h-8 w-[52px] items-center justify-center rounded-xl", current && "bg-accent text-primary ring-1 ring-primary/45")}>
          <Icon className="size-[22px]" />
        </span>
        {item.label}
      </Link>
    );
  });
}
