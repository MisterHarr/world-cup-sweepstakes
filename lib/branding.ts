/** sRGB hex for `:root --background` (oklch(0.13 0.01 240)) — manifest + viewport `theme-color`. */
export const themeColorHex = "#0f1218" as const;

export const BRANDING = {
  appName: "Cup Draw 2026",
  shortName: "Cup Draw 2026",
  tagline: "Pick one. Draw five. Chase the cup.",
  /** 256×256 WebP — use for small UI contexts (header, nav, 40–64px). */
  logoSrc: "/branding/cup-draw-logo-256-rounded.webp",
  /** 512×512 AVIF — use for large display contexts (hero, OG, manifest). */
  logo512Src: "/branding/cup-draw-logo-512-rounded.avif",
  logoAlt: "Cup Draw 2026 logo",
} as const;

export type BrandingConfig = typeof BRANDING;
