# Safe areas (notched devices)

**Last updated:** 2026-03-27  
**Prerequisite:** Root layout sets `viewportFit: "cover"` so `env(safe-area-inset-*)` is available on supported browsers.

## Utilities (`app/globals.css`)

| Class | Effect |
|-------|--------|
| `pt-safe` | `padding-top: env(safe-area-inset-top)` |
| `pb-safe` | `padding-bottom: env(safe-area-inset-bottom)` |
| `pl-safe` / `pr-safe` | Left / right insets |

For controls that also need a fixed offset (e.g. `1rem` from the edge), components use **`calc()`** such as `top-[calc(1rem+env(safe-area-inset-top))]`.

## Surfaces covered

| Area | Implementation |
|------|----------------|
| `AppShell` header | Top padding includes notch: `pt-[calc(1rem+env(safe-area-inset-top))]` |
| `AppShellV0` floating nav + mobile menu | Fixed positions use `calc(...)` for top/right |
| Guide page sticky header | `pt-[env(safe-area-inset-top)]` on the header bar |
| Leaderboard squad drawer | `pt-safe` + `pb-safe` on the sliding panel; sticky “You” row uses bottom safe inset |
| Reveal “See My Teams” CTA | Bottom position includes `env(safe-area-inset-bottom)` |

Re-audit when adding new **fixed** or **sticky** chrome, especially bottom bars and full-screen sheets.

## Touch targets (Phase E)

Primary shell navigation (`AppShellV0`, `AppShell` sign-out) and **auth** controls on `/` use **≥ 44×44 CSS px** (`h-11` / `Button` default size) where feasible so small phones meet common accessibility guidance.
