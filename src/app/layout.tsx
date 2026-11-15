import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: next-themes sets the "dark" class on <html> before hydration.
    <html lang="en" className={`${fontVariables} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        {/* Clerk reads the current path and the session, which are request-time data: with cache
            components that has to sit inside Suspense (C61). */}
        <Suspense fallback={null}>
          <ClerkProvider>
            <Providers>{children}</Providers>
          </ClerkProvider>
        </Suspense>
      </body>
    </html>
  );
}
