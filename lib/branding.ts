/** sRGB hex for `:root --background` (oklch(0.13 0.01 240)) — manifest + viewport `theme-color`. */
export const themeColorHex = "#0f1218" as const;

export const BRANDING = {
  appName: "Cup Draw 2026",
  shortName: "Cup Draw 2026",
  tagline: "Pick one. Draw five. Chase the cup.",
  logoSrc: "/branding/featured-five-2026-mark.svg",
  logoAlt: "Cup Draw 2026 mark",
} as const;

export type BrandingConfig = typeof BRANDING;
