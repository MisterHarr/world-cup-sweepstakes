# Branding Lock

**Locked On:** 2026-02-18
**Status:** Active for UI/UX Sprint 1

## Locked Inputs

- **Game Name:** `GIS 2026 Featured Five Challenge`
- **Short Name:** `Featured Five 2026`
- **Tagline:** `Pick 1. Draw 5. Chase the Cup.`
- **Copyright-safe Logo Asset:** `/public/branding/featured-five-2026-mark.svg`
- **Code Source of Truth:** `/lib/branding.ts`

## Rules

1. All user-facing titles and logo references must consume `/lib/branding.ts`.
2. Do not hardcode legacy naming (`World Cup Sweepstakes`) in app surfaces.
3. Logo usage should use the local asset, not external third-party logo URLs.
4. If brand wording changes, update `/lib/branding.ts` first, then run app-wide replacement.

## Applied in Sprint 1 Step 1

- `/components/AuthLandingPage.tsx`
- `/components/AppShell.tsx`
- `/app/dashboard/page.tsx`
- `/app/leaderboard/page.tsx`
- `/app/badges/page.tsx`
- `/app/transfer-history/page.tsx`
