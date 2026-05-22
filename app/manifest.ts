import type { MetadataRoute } from "next";

import { BRANDING, themeColorHex } from "@/lib/branding";

export default function manifest(): MetadataRoute.Manifest {
  const description = `${BRANDING.tagline} Play along with ${BRANDING.shortName}.`;

  return {
    name: BRANDING.appName,
    short_name: BRANDING.shortName,
    description,
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: themeColorHex,
    theme_color: themeColorHex,
    icons: [
      {
        src: BRANDING.logoSrc,
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
    ],
  };
}
