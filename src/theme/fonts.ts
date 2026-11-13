/**
 * Fonts — the ONE place to change typefaces (DECISIONS C3).
 *
 * To re-brand, swap the imports/constructors below for any next/font/google (or next/font/local)
 * font. Keep the `variable` names: theme wiring in src/app/globals.css reads
 * --font-brand-sans and --font-brand-mono, so nothing else changes.
 *
 * Geist is a PLACEHOLDER until branding is decided (P9).
 */
import { Geist, Geist_Mono } from "next/font/google";

export const brandSans = Geist({
  variable: "--font-brand-sans",
  subsets: ["latin"],
});

export const brandMono = Geist_Mono({
  variable: "--font-brand-mono",
  subsets: ["latin"],
});

/** Class names to put on <html> so both font CSS variables are defined. */
export const fontVariables = `${brandSans.variable} ${brandMono.variable}`;
