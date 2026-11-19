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

/** Browser bar colour follows the theme: dark by default (C92), light when the phone is in light mode. */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: appConfig.themeColors.light },
    { media: "(prefers-color-scheme: dark)", color: appConfig.themeColors.dark },
  ],
  colorScheme: "dark light",
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
