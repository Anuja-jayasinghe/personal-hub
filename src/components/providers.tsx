"use client";

import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DEFAULT_PALETTE, PALETTE_IDS, PALETTE_STORAGE_KEY } from "@/theme/palettes";

/** App-wide client providers: the colour palette (DECISIONS C89, replacing the light/dark switch of C31) and tooltips for the sidebar. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-palette" themes={PALETTE_IDS} defaultTheme={DEFAULT_PALETTE} enableSystem={false} storageKey={PALETTE_STORAGE_KEY} disableTransitionOnChange>
      <TooltipProvider>{children}</TooltipProvider>
    </ThemeProvider>
  );
}
