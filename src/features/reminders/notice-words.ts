import { appConfig } from "@/config/app.config";

/**
 * The words a notification may use for a service (C139, review of #198). A service's type is free text
 * (the form only suggests the list), and a notice must never carry free text. So only the fixed types
 * in app.config.ts pass, written as they are there; anything else, and "Other", becomes "Service".
 * Pure.
 */
export function serviceNoticeWord(serviceType: string): string {
  const typed = serviceType.trim().toLowerCase();
  const known = appConfig.vehicles.serviceTypes.find((t) => t.toLowerCase() === typed);
  return known && known !== "Other" ? known : "Service";
}
