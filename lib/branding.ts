/** sRGB hex for `:root --background` (oklch(0.13 0.01 240)) — manifest + viewport `theme-color`. */
export const themeColorHex = "#0f1218" as const;

export const BRANDING = {
  appName: "GIS 2026 Featured Five Challenge",
  shortName: "Featured Five 2026",
  tagline: "Pick 1. Draw 5. Chase the Cup.",
  logoSrc: "/branding/featured-five-2026-mark.svg",
  logoAlt: "Featured Five 2026 cup mark",
} as const;

export type BrandingConfig = typeof BRANDING;
