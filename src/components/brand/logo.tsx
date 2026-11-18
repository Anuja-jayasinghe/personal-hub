import { appConfig } from "@/config/app.config";
import { HubMark } from "./hub-mark";

/**
 * Logo shown in the header and sidebar: the J mark in the brand blue (C90). `size` is its height.
 * Pass `decorative` when the app name is written right next to it, so screen readers do not hear it twice.
 */
export function Logo({ size = 32, decorative = false }: { size?: number; decorative?: boolean }) {
  return <HubMark size={size} title={decorative ? "" : appConfig.logo.alt} className="shrink-0 text-primary" />;
}
