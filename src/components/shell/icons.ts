import { Car, CircleHelp, Home, Receipt, Settings, Zap, type LucideIcon } from "lucide-react";

/**
 * Maps the icon names used in app.config.ts to lucide icons. Add a line here when a new module
 * introduces a new icon name.
 */
const icons: Record<string, LucideIcon> = {
  home: Home,
  car: Car,
  zap: Zap,
  receipt: Receipt,
  settings: Settings,
};

export function getIcon(name: string): LucideIcon {
  return icons[name] ?? CircleHelp;
}
