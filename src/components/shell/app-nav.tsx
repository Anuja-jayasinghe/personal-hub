"use client";

import { usePathname } from "next/navigation";
import type { NavItem } from "@/components/shell/nav";
import { NavLinks } from "@/components/shell/nav-links";

/**
 * NavLinks with the current page read from the URL. usePathname() is request-time data on pages with
 * a changing id (/vehicles/[id]), so callers wrap this in Suspense with a plain NavLinks as fallback.
 */
export function CurrentNavLinks({ items, variant }: { items: NavItem[]; variant: "bar" | "rail" }) {
  const pathname = usePathname();
  return <NavLinks items={items} pathname={pathname} variant={variant} />;
}
