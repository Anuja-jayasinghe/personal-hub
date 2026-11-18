"use client";

import { ThemeProvider } from "next-themes";

/** App-wide client providers: the theme (dark by default, C92; Light and System stay as choices, C31). */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
