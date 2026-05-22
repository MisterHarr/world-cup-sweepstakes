import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import "./globals.css";

import { AuthSignedOutRedirect } from "@/components/AuthSignedOutRedirect";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { PageLiftRoot } from "@/components/PageLiftRoot";
import { BRANDING, themeColorHex } from "@/lib/branding";

const fontFfDisplay = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-ff-display",
  display: "swap",
});

const fontFfUi = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ff-ui",
  display: "swap",
});

/** Base URL for absolute metadata (OG, etc.). Set in production via NEXT_PUBLIC_APP_URL. */
const metadataBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

const description = `${BRANDING.tagline} Play along with ${BRANDING.shortName}.`;

export const metadata: Metadata = {
  metadataBase: new URL(metadataBaseUrl),
  title: {
    default: BRANDING.appName,
    template: `%s | ${BRANDING.shortName}`,
  },
  description,
  openGraph: {
    title: BRANDING.appName,
    description,
    siteName: BRANDING.shortName,
    type: "website",
    images: [{ url: BRANDING.logoSrc, alt: BRANDING.logoAlt }],
  },
  twitter: {
    card: "summary_large_image",
    title: BRANDING.appName,
    description,
    images: [BRANDING.logoSrc],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // Allow pinch zoom for accessibility
  userScalable: true,
  viewportFit: "cover", // iOS safe area support
  themeColor: themeColorHex,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fontFfDisplay.variable} ${fontFfUi.variable}`}>
      <body className="antialiased">
        <OfflineIndicator />
        <AuthSignedOutRedirect />
        <PageLiftRoot>{children}</PageLiftRoot>
      </body>
    </html>
  );
}
