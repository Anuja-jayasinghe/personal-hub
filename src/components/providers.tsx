"use client";

import { ThemeProvider } from "next-themes";
import { UndoToastProvider } from "@/components/shared/undo-toast";

/**
 * App-wide client providers: the theme (dark by default, C92; Light and System stay as choices, C31)
 * and the Undo message (R.3b).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <UndoToastProvider>{children}</UndoToastProvider>
    </ThemeProvider>
  );
}
