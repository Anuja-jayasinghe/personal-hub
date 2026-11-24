import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { clerkAppearance } from "@/components/brand/clerk-appearance";
import { Providers } from "@/components/providers";
import { appConfig } from "@/config/app.config";
import { fontVariables } from "@/theme/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: appConfig.name,
    template: `%s · ${appConfig.name}`,
  },
  description: appConfig.description,
};

/**
 * The browser bar colour starts as the dark one (the app opens dark, C92); `ThemeColorSync` (providers) switches
 * it to the light one when the hub is in light mode. A `prefers-color-scheme` pair would follow the phone instead
 * of the hub's own Dark / Light / Follow phone choice, so a dark hub on a light phone got a white bar.
 * `viewportFit: "cover"` lets the page use the whole screen; the shell pads for the notch and the home
 * indicator with `env(safe-area-inset-*)` (issue #42).
 */
export const viewport: Viewport = {
  themeColor: appConfig.themeColors.dark,
  colorScheme: "dark light",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: next-themes sets the "dark" class on <html> before hydration.
    <html lang="en" className={`${fontVariables} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        {/* Clerk reads the current path and the session, which are request-time data: with cache
            components that has to sit inside Suspense (C61). */}
        <Suspense fallback={null}>
          <ClerkProvider appearance={clerkAppearance}>
            <Providers>{children}</Providers>
          </ClerkProvider>
        </Suspense>
      </body>
    </html>
  );
}
