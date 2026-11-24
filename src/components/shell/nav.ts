import { appConfig, enabledModules } from "@/config/app.config";

/** One link in the phone bar or the desktop rail. */
export type NavItem = { key: string; label: string; href: string; icon: string };

const home: NavItem = { key: "home", label: "Home", href: "/", icon: "home" };
const settings: NavItem = { key: "settings", label: "Settings", href: "/settings", icon: "settings" };
const more: NavItem = { key: "more", label: "More", href: "/more", icon: "more" };

/** Electricity first: it is what the hub exists for (C83). Other modules keep their config order. */
const moduleOrder = ["electricity", "vehicles", "bills"];

function moduleItems(): NavItem[] {
  return [...enabledModules]
    .sort((a, b) => moduleOrder.indexOf(a.key) - moduleOrder.indexOf(b.key))
    .map((m) => ({ key: m.key, label: m.navLabel, href: m.href, icon: m.icon }));
}

function sharedItems(): NavItem[] {
  return appConfig.sharedPages.map((p) => ({ key: p.key, label: p.navLabel, href: p.href, icon: p.icon }));
}

/** Desktop rail, top group: Home, Electricity, Vehicles, Bills, Reminders, Tasks (DESIGN.md order). */
export function railItems(): NavItem[] {
  return [home, ...moduleItems(), ...sharedItems()];
}

/** Desktop rail, pinned to the bottom: Settings (S.1, owner's list item 8). */
export function railBottomItems(): NavItem[] {
  return [settings];
}

/** Phone bar: Home, Vehicles, Electricity, Bills, More (DESIGN.md). The rest lives on the More page. */
export function phoneBarItems(): NavItem[] {
  const phoneOrder = ["vehicles", "electricity", "bills"];
  const mods = [...moduleItems()].sort((a, b) => phoneOrder.indexOf(a.key) - phoneOrder.indexOf(b.key));
  return [home, ...mods, more];
}

/** Pages reached from the More tab, so the tab shows as current while you are on them. */
export function morePageItems(): NavItem[] {
  return [...sharedItems(), settings];
}

/** True when `pathname` is inside `item` (Home only matches "/"). More also covers the pages it lists. */
export function isCurrent(item: NavItem, pathname: string): boolean {
  if (item.href === "/") return pathname === "/";
  if (item.key === "more") return pathname.startsWith("/more") || pathname.startsWith("/notifications") || morePageItems().some((p) => pathname.startsWith(p.href));
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
