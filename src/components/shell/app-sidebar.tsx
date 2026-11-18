"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { AccountMenu } from "@/components/shell/account-menu";
import { getIcon } from "@/components/shell/icons";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { appConfig, enabledModules } from "@/config/app.config";

type NavItem = { label: string; href: string; icon: string };

const mainItems: NavItem[] = [
  { label: "Home", href: "/", icon: "home" },
  ...appConfig.sharedPages.map((p) => ({ label: p.label, href: p.href, icon: p.icon })),
];
const moduleItems: NavItem[] = enabledModules.map((m) => ({
  label: m.label,
  href: m.href,
  icon: m.icon,
}));
const footerItems: NavItem[] = [{ label: "Settings", href: "/settings", icon: "settings" }];

function NavGroup({ label, items }: { label?: string; items: NavItem[] }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarGroup>
      {label ? <SidebarGroupLabel>{label}</SidebarGroupLabel> : null}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const Icon = getIcon(item.icon);
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={active}
                  tooltip={item.label}
                  render={
                    <Link
                      href={item.href}
                      onClick={() => {
                        if (isMobile) setOpenMobile(false);
                      }}
                    />
                  }
                >
                  <Icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

/**
 * Logo and name, with the collapse button inside the panel (C77). Collapsed, the button sits under
 * the logo so the panel can be opened again. On a phone the panel is a slide-out, so its button
 * stays in the top bar (see the app layout) and is not repeated here.
 */
function SidebarTop() {
  const { isMobile, state } = useSidebar();
  const expanded = state === "expanded";
  return (
    <div className="flex items-center gap-2 px-1 py-1 group-data-[collapsible=icon]:flex-col">
      <Logo size={30} decorative />
      <span className="truncate text-lg font-semibold tracking-tight group-data-[collapsible=icon]:hidden">{appConfig.name}</span>
      {isMobile ? null : (
        <SidebarTrigger
          className="ml-auto group-data-[collapsible=icon]:ml-0"
          aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
          aria-expanded={expanded}
        />
      )}
    </div>
  );
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarTop />
      </SidebarHeader>
      {/* usePathname() is request-time data on pages with a changing id (/vehicles/[id]), so the
          links sit inside Suspense; the sidebar frame renders immediately. */}
      <SidebarContent>
        <Suspense fallback={null}>
          <NavGroup items={mainItems} />
          <NavGroup label="Modules" items={moduleItems} />
        </Suspense>
      </SidebarContent>
      <SidebarFooter>
        <Suspense fallback={null}>
          <NavGroup items={footerItems} />
        </Suspense>
        <AccountMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
