# Shell convergence (target architecture)

**Created:** 2026-03-26  
**Status:** Incremental — shared primitives first, full merge later.

## Current shells

| Shell | Used by | Role |
|-------|---------|------|
| **`AppShellV0`** | Dashboard, guide, badges, leaderboard standalone, charity, etc. | Floating icon nav (top-right), no tagline in header |
| **`AppShell`** | Featured-team flow, some onboarding | Full-width header with **tagline** under short name, optional sign-out |

## Problems

- Two header layouts (logo + title vs logo + short name + tagline) diverge visually.
- Dashboard uses **long app name**; `AppShell` uses **short name** + tagline — intentional for space, but styling (logo box, typography) should stay aligned.

## Target

1. **Single source for branding chrome** — logo + titles via **`AppBrandBlock`** (`components/AppBrandBlock.tsx`). Tune variants via `logoTone` (`glass` for gradient/game surfaces, `elevated` for flat `bg-background` shells).
2. **Keep two shells** until product needs one chrome: `AppShellV0` owns global game nav; `AppShell` owns simpler flows without floating nav.
3. **Next steps (later):** optional `AppHeader` wrapper for padding/max-width. Safe-area insets and touch targets for shell chrome are documented in **`SAFE-AREAS.md`**.

## Conventions

- **Dashboard / game surfaces:** `AppBrandBlock` with `title={BRANDING.appName}`, `logoTone="glass"`.
- **Onboarding / featured team:** `AppBrandBlock` with `title={BRANDING.shortName}`, `tagline={BRANDING.tagline}`, `logoTone="elevated"`.

## Dashboard: single navigation surface

Section switching on `/dashboard` (My Teams, embedded leaderboard, Live, Transfer) uses the **same floating `AppShellV0` menu** as the rest of the app. The header is **branding + signed-in identity only** — no second nav row under it, so users are not presented with two menus.
