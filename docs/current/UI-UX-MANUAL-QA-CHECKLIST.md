# UI/UX Manual QA Checklist

**Last Updated:** 2026-02-18  
**Scope:** Post-Sprint cross-device validation for production readiness  
**Related:** `/docs/current/UI-UX-POLISH-BACKLOG.md`

## Device Matrix

- [ ] Mobile small: 360x780 (Chrome DevTools)
- [ ] Mobile large: 430x932 (Chrome DevTools)
- [ ] Tablet: 768x1024 (Chrome DevTools)
- [ ] Desktop: 1440x900 (native browser window)

## Pre-Flight

- [ ] Start app: `npm run dev`
- [ ] Confirm Firebase auth domain and callable connectivity are healthy
- [ ] Clear local storage/session for one clean onboarding run
- [ ] Keep one seeded admin account and one non-admin account ready

## Core Flows

- [ ] `/` landing: typography hierarchy is clean; auth buttons visible without overflow
- [ ] `/` auth (Google + email): successful sign-in/sign-up without popup loops
- [ ] `/department`: option cards remain centered and readable on mobile
- [ ] `/featured-team`: filters, selection state, and card layout remain stable across breakpoints
- [ ] Featured confirmation dialog: no accessibility warnings in console (`Description`/ARIA)
- [ ] `/reveal`: featured team 2x state is visually distinct and readable on mobile
- [ ] `/dashboard?tab=portfolio`: summary cards and expanded team cards are legible on mobile
- [ ] `/dashboard?tab=leaderboard`: podium keeps intended structure on narrow screens
- [ ] `/dashboard?tab=bracket`: header hierarchy and live count alignment hold on mobile
- [ ] `/dashboard?tab=market`: rows remain readable and selectable on mobile; hold-to-trade works
- [ ] `/transfer-history`: cards/timeline remain readable on mobile
- [ ] `/leaderboard`: tabs/squad drawer scroll and typography are stable on small screens
- [ ] `/badges`: filters work; locked vs unlocked visual states are clear
- [ ] `/guide`: quick-start, FAQ, and scoring formulas are readable on mobile + desktop
- [ ] `/charity` (if enabled): provider links render and open correctly; terms/disclaimer visible

## Header + Navigation

- [ ] Mobile top-right identity text is visible (not hidden under nav toggle)
- [ ] Desktop identity text shows full `Signed in as ...` label
- [ ] Transfer tab remains last in navigation order
- [ ] Mobile nav open/close state is consistent and not clipped

## Admin + Permissions

- [ ] Non-admin access is blocked for `/admin` and `/admin/users`
- [ ] Admin can open/close transfer window in `/admin/fixtures`
- [ ] Transfer-window state immediately affects `/dashboard?tab=market`

## Visual + Accessibility Checks

- [ ] No major overflow, clipping, or horizontal scroll regressions
- [ ] Body/headline typography feels consistent across core pages
- [ ] Contrast is acceptable for muted text over gradients
- [ ] Keyboard focus styles remain visible for nav/buttons/dialog controls

## Console Health

- [ ] No repeated auth popup loop errors
- [ ] No `setState in render` React errors
- [ ] No dialog accessibility warnings

## Sign-Off

- [ ] Capture findings in `/docs/current/UI-UX-POLISH-BACKLOG.md`
- [ ] Classify each finding by severity (`P1`, `P2`, `P3`)
- [ ] Re-test all `P1` fixes before merge
