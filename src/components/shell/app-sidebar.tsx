"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
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

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-1">
          <Logo size={32} />
          <span className="truncate font-semibold group-data-[collapsible=icon]:hidden">
            {appConfig.name}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup items={mainItems} />
        <NavGroup label="Modules" items={moduleItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavGroup items={footerItems} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
