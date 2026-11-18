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
    return (
      <Link
        key={item.key}
        href={item.href}
        aria-current={current ? "page" : undefined}
        className={cn(
          "group flex flex-col items-center gap-1 rounded-xl text-[10.5px] leading-none outline-none focus-visible:ring-2 focus-visible:ring-ring",
          variant === "rail" ? "w-[72px] py-2.5" : "min-h-11 justify-center py-1",
          variant === "rail" && current && "bg-accent ring-1 ring-primary/45",
          current ? "font-semibold text-foreground" : "font-medium text-label hover:text-foreground",
        )}
      >
        <span
          className={cn(
            "flex items-center justify-center",
            variant === "bar" && "h-8 w-[52px] rounded-xl",
            variant === "bar" && current && "bg-accent ring-1 ring-primary/45",
            current && "text-primary",
          )}
        >
          <Icon className="size-[22px]" />
        </span>
        {item.label}
      </Link>
    );
  });
}
