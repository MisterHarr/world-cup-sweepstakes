import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    // Strip console.* calls from production bundles (token-efficient debug log hardening).
    removeConsole: process.env.NODE_ENV === "production",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
