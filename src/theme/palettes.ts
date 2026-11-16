/**
 * The colour palettes (DECISIONS C89). The colours themselves live in src/theme/theme.css as one
 * block per palette (`[data-palette="id"]`); this list gives each palette its name, a description
 * and four swatches for the picker, and says which are dark. A test checks that the list, the CSS
 * blocks and the dark-mode variant in globals.css agree.
 */

export const PALETTES = [
  {
    id: "paper",
    label: "Paper & Ink",
    description: "Clean and quiet: off-white page, charcoal ink, royal blue.",
    dark: false,
    /** Page, card, primary, secondary accent: for the little preview in the picker. */
    swatches: ["#f9fafb", "#ffffff", "#111827", "#2563eb"],
  },
  {
    id: "terminal",
    label: "Cyberpunk Terminal",
    description: "High-contrast night mode: void black, terminal green, neon orchid.",
    dark: true,
    swatches: ["#09090b", "#18181b", "#22c55e", "#e879f9"],
  },
  {
    id: "bauhaus",
    label: "Swiss Bauhaus",
    description: "Industrial grey with signal orange and jet black.",
    dark: false,
    swatches: ["#e5e5e5", "#f4f4f4", "#ea580c", "#171717"],
  },
  {
    id: "midnight",
    label: "Midnight Slate & Electric Cyan",
    description: "Deep blue-greys with cyan and indigo, easy on the eyes at night.",
    dark: true,
    swatches: ["#0f172a", "#1e293b", "#38bdf8", "#818cf8"],
  },
] as const;

export type PaletteId = (typeof PALETTES)[number]["id"];

export const PALETTE_IDS = PALETTES.map((p) => p.id) as PaletteId[];
/** Paper & Ink: also what shows when nothing has been chosen (it is written on :root in theme.css). */
export const DEFAULT_PALETTE: PaletteId = "paper";
/** The browser remembers the choice under this key (a new key, so the old light/dark/system value is ignored). */
export const PALETTE_STORAGE_KEY = "hub-palette";
