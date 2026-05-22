import type { NextConfig } from "next";

function buildCspReportOnlyValue() {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https://*.googleusercontent.com https://*.gstatic.com https://*.googleapis.com https://*.firebaseapp.com https://*.firebasestorage.app https://firebasestorage.googleapis.com https://www.paypal.com https://www.paypalobjects.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://apis.google.com https://www.paypal.com https://www.paypalobjects.com",
    "connect-src 'self' ws: wss: https://*.googleapis.com https://*.firebaseapp.com https://*.gstatic.com https://*.googleusercontent.com https://*.cloudfunctions.net https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://firestore.googleapis.com https://firebaseinstallations.googleapis.com https://api.football-data.org https://api.sportmonks.com https://www.paypal.com",
    "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com https://www.paypal.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ];

  return directives.join("; ");
}

const cspReportOnlyValue = buildCspReportOnlyValue();

const nextConfig: NextConfig = {
  compiler: {
    // Strip console.* calls from production bundles (token-efficient debug log hardening).
    removeConsole: process.env.NODE_ENV === "production",
  },
  async redirects() {
    return [
      { source: "/login", destination: "/", permanent: true },
    ];
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
          {
            key: "Content-Security-Policy-Report-Only",
            value: cspReportOnlyValue,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
