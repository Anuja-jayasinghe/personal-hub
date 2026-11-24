"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { useEffect } from "react";
import { appConfig } from "@/config/app.config";
import { UndoToastProvider } from "@/components/shared/undo-toast";

/** Keeps the browser bar colour (the theme-color meta) in step with the look the hub shows, not the phone's. */
function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (!resolvedTheme) return;
    const color = resolvedTheme === "light" ? appConfig.themeColors.light : appConfig.themeColors.dark;
    const metas = document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    if (metas.length === 0) {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.content = color;
      document.head.appendChild(meta);
      return;
    }
    metas.forEach((meta) => {
      meta.content = color;
    });
  }, [resolvedTheme]);
  return null;
}

/**
 * App-wide client providers: the theme (dark by default, C92; Light and System stay as choices, C31)
 * and the Undo message (R.3b).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <ThemeColorSync />
      <UndoToastProvider>{children}</UndoToastProvider>
    </ThemeProvider>
  );
}
