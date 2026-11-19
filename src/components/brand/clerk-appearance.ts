/**
 * Clerk's sign-in, sign-up and account boxes in the hub look (R.6; DESIGN.md, boards HSignIn and
 * HSignInPhone), through Clerk's own appearance options rather than by overriding its CSS.
 * The colours point at the theme variables in src/theme/theme.css, so light and dark both follow.
 * Clerk's styles sit in the "clerk" CSS layer (declared in globals.css) so Tailwind classes in
 * `elements` win over them.
 */
export const clerkAppearance = {
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "var(--primary)",
    colorPrimaryForeground: "var(--primary-foreground)",
    colorBackground: "var(--card)",
    colorForeground: "var(--foreground)",
    colorMuted: "var(--raised)",
    colorMutedForeground: "var(--muted-foreground)",
    colorNeutral: "var(--foreground)",
    colorInput: "var(--background)",
    colorInputForeground: "var(--foreground)",
    colorBorder: "var(--border)",
    colorRing: "var(--ring)",
    colorDanger: "var(--status-overdue)",
    colorSuccess: "var(--status-ok)",
    colorWarning: "var(--status-soon)",
    colorModalBackdrop: "rgb(13 17 24 / 0.7)",
    // The brand has no drop shadows (DESIGN.md, Elevation).
    colorShadow: "transparent",
    fontFamily: "var(--font-brand-sans), ui-sans-serif, system-ui, sans-serif",
    fontFamilyButtons: "var(--font-brand-sans), ui-sans-serif, system-ui, sans-serif",
    borderRadius: "0.75rem",
    fontSize: "0.9375rem",
  },
  elements: {
    // The page draws its own card and heading (the hub frame), so Clerk's box is flat inside it.
    rootBox: "w-full",
    cardBox: "w-full max-w-none shadow-none border-0 rounded-none bg-transparent",
    card: "bg-transparent shadow-none border-0 p-0 gap-6",
    header: "hidden",
    footer: "bg-none bg-transparent [&>*]:bg-transparent",
    // Clerk draws button edges with box-shadow, so leave its shadows on buttons alone.
    formButtonPrimary: "min-h-12 text-[15px] font-semibold",
    socialButtonsBlockButton: "min-h-12 shadow-[inset_0_0_0_1px_var(--hub-edge)] hover:bg-raised",
    dividerLine: "bg-border",
    formFieldInput: "min-h-12 shadow-[inset_0_0_0_1px_var(--hub-edge)] focus:shadow-[inset_0_0_0_1.5px_var(--hub-blue)]",
    dividerText: "font-mono text-[10.5px] tracking-[0.14em] uppercase text-label",
    // The profile circle at the top right of each page (S.1): 36px, like the other header buttons.
    userButtonAvatarBox: "size-9",
    formFieldLabel: "text-[13px] font-medium text-muted-foreground",
  },
} as const;
