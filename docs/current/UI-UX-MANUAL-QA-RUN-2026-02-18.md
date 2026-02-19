# UI/UX Manual QA Run Sheet (2026-02-18)

**Run Date:** 2026-02-18  
**Owner:** Product + Engineering  
**Related Checklist:** `/docs/current/UI-UX-MANUAL-QA-CHECKLIST.md`  
**Backlog Target:** `/docs/current/UI-UX-POLISH-BACKLOG.md`

## Automated Pre-Check (Engineer)

- `npm run lint`: pass (0 errors)
- `npm run build`: pass
- Route health check (HTTP 200): `/`, `/department`, `/featured-team`, `/reveal`, `/dashboard`, `/leaderboard`, `/badges`, `/transfer-history`, `/admin`, `/admin/users`

## Session Setup

- [ ] App running via `npm run dev`
- [ ] Admin account ready
- [ ] Non-admin account ready
- [ ] Clean-session browser available (incognito/private)

## Device Coverage

- [ ] Mobile small (360x780)
- [ ] Mobile large (430x932)
- [ ] Tablet (768x1024)
- [ ] Desktop (1440x900)

## Route Pass Matrix

| Route / Flow | Mobile Small | Mobile Large | Tablet | Desktop | Notes |
|---|---|---|---|---|---|
| `/` landing + auth entry | [ ] | [ ] | [ ] | [ ] | |
| `/department` | [ ] | [ ] | [ ] | [ ] | |
| `/featured-team` + confirmation dialog | [ ] | [ ] | [ ] | [ ] | |
| `/reveal` | [ ] | [ ] | [ ] | [ ] | |
| `/dashboard?tab=portfolio` | [ ] | [ ] | [ ] | [ ] | |
| `/dashboard?tab=leaderboard` | [ ] | [ ] | [ ] | [ ] | |
| `/dashboard?tab=bracket` | [ ] | [ ] | [ ] | [ ] | |
| `/dashboard?tab=market` | [ ] | [ ] | [ ] | [ ] | |
| `/transfer-history` | [ ] | [ ] | [ ] | [ ] | |
| `/leaderboard` | [ ] | [ ] | [ ] | [ ] | |
| `/badges` | [ ] | [ ] | [ ] | [ ] | |
| `/admin` + `/admin/users` (admin only) | [ ] | [ ] | [ ] | [ ] | |

## Critical Assertions

- [ ] Non-admin blocked from `/admin` and `/admin/users`
- [ ] Transfer window toggle in `/admin/fixtures` changes `/dashboard?tab=market` behavior immediately
- [ ] No auth popup loop
- [ ] No dialog ARIA warnings
- [ ] No React runtime errors in console
- [ ] Transfer nav appears last in nav order
- [ ] Mobile signed-in identity remains visible

## Findings Log

| ID | Priority | Route | Viewport | Repro Steps | Expected | Actual | Screenshot |
|---|---|---|---|---|---|---|---|
| F-001 | P1 | `/` (email auth) | Desktop + mobile | Try email sign-up with existing email | Friendly prompt, no noisy console overlay | Patched: existing-email sign-up now switches to sign-in mode with clear message | |
| F-002 | P1 | Shared shell offline banner | Desktop + mobile | Open app in normal online state | No persistent false offline warning | Patched: indicator now starts optimistic + connectivity probe before showing offline state | |
| F-003 | P2 | `/reveal` completion CTA | Mobile + desktop | Complete reveal flow | Friendly, prominent next-action CTA | Patched: sticky bottom CTA now reads `See My Teams` | |
| F-004 | P2 | `/reveal` cards | Small mobile | Reveal cards on narrow screen | More than one card visible and reduced scrolling | Patched: denser 2-column small-screen reveal cards with scaled typography/media | |
| F-005 | P3 | `/dashboard?tab=portfolio` | Mobile | Expand team cards | Recent Form + Next Match compact and space-efficient | Patched: Recent Form and Next Match now share a row; stats moved below | |
| F-006 | P2 | `/leaderboard` squad drawer | Mobile + desktop | Open squad details | Left column: flag/name/id, right column: tier/points; captain badge solid | Patched: card layout reorganized and `CAPTAIN 2x` made solid/non-transparent | |
| F-007 | P2 | `/badges` | Mobile + desktop | Review rarity/filter controls | No duplicate legend+nav, cleaner hierarchy, uncommon taxonomy | Patched: common promoted to uncommon display, legend removed, centered title/progress cleanup | |
| F-008 | P1 | `/dashboard?tab=market` transfer flow | Mobile + desktop | Hold-to-confirm transfer to 100% | No React `setState in render` runtime error | Patched: moved transfer execution trigger out of state-updater callback using ref-based progress loop | |
| F-009 | P1 | `/dashboard` + `/leaderboard` score/squad parity | Mobile + desktop | Compare My Teams score + own squad drawer with leaderboard | Own score should not fall to stale zero fallback; own squad drawer should populate | Patched: resilient leaderboard id parsing (`userId`/`uid`/`id`) + local score/squad fallback for current user | |

## Sign-Off

- [ ] All P1 findings fixed and re-tested
- [ ] New findings copied to `/docs/current/UI-UX-POLISH-BACKLOG.md`
- [ ] Build green after fixes (`npm run lint`, `npm run build`)
