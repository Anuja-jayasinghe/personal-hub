/**
 * Fonts — the ONE place to change typefaces (DECISIONS C3, C90).
 *
 * The hub brand: Sora for everything you read and tap, JetBrains Mono for dates, readings and labels,
 * Oxanium for page titles and the big numbers (DESIGN.md). All three are variable fonts from
 * next/font/google, which downloads them at build time and serves them from this app (no request to
 * Google from the browser).
 *
 * Keep the `variable` names: src/app/globals.css reads --font-brand-sans, --font-brand-mono and
 * --font-brand-display (utilities font-sans, font-mono, font-display).
 */
import { JetBrains_Mono, Oxanium, Saira_Semi_Condensed, Sora } from "next/font/google";

export const brandSans = Sora({
  variable: "--font-brand-sans",
  subsets: ["latin"],
});

export const brandMono = JetBrains_Mono({
  variable: "--font-brand-mono",
  subsets: ["latin"],
});

export const brandDisplay = Oxanium({
  variable: "--font-brand-display",
  subsets: ["latin"],
});

/**
 * Saira Semi Condensed: only the number plate on the vehicle card (C130). The real plate uses FE-Schrift,
 * which is not free to use; this is the closest free face. Not a variable font, so one weight.
 */
export const plateFont = Saira_Semi_Condensed({
  variable: "--font-brand-plate",
  subsets: ["latin"],
  weight: "600",
});

/** Class names to put on <html> so every font CSS variable is defined. */
export const fontVariables = `${brandSans.variable} ${brandMono.variable} ${brandDisplay.variable} ${plateFont.variable}`;
