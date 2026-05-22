# HTTP headers (Next.js)

**Last updated:** 2026-03-26  
**Source of truth:** `next.config.ts`

## Global response headers

| Header | Value | Purpose |
|--------|--------|---------|
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` | Allows Firebase / Google OAuth popups while keeping a stricter default than `unsafe-none`. Applied to `/:path*`. |

## Compiler

- **`removeConsole`** — enabled in production builds (strips `console.*` from client bundles). Errors should still surface via UI state, not only logs.

## Content-Security-Policy (CSP)

**Configured in report-only mode** in `next.config.ts` via `Content-Security-Policy-Report-Only`.

Current allowlist coverage includes:

- Firebase Auth / Identity Toolkit
- Firestore and Firebase client endpoints
- Cloud Functions HTTPS
- Google Fonts / GStatic
- Google OAuth popup origins
- PayPal / Stripe-related charity surfaces where applicable
- Real provider API endpoints used during operator rehearsal

Keep this header in **report-only** mode until reports are reviewed and any missing origins are intentionally added. Document the eventual enforced policy alongside deployment (Vercel / Firebase Hosting / CloudFront).

## Client error surfaces (audit note)

- **`app/error.tsx`** / **`app/admin/error.tsx`** / **`app/dashboard/error.tsx`**: `error.message` only when `NODE_ENV === "development"`.
- **`components/ErrorBoundary.tsx`**: message + stack in `<details>` only in development; production shows generic copy.
- **`RouteErrorFallback`**: `error.message` only in development.
- **`app/dashboard/page.tsx`**: `friendlyErrorMessage()` maps `permission-denied`, `unavailable`, `auth/network-request-failed`; in **production**, unknown errors resolve to the provided fallback string (no raw SDK strings).

## Related

- `docs/current/FIREBASE-SURFACE.md` — callable endpoints and regions.
- `docs/current/ENV-VARS.md` — environment variables.
