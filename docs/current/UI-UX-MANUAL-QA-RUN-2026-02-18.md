# UI/UX Manual QA Run Sheet (2026-02-18)

**Run Date:** 2026-02-18  
**Owner:** Product + Engineering  
**Related Checklist:** `/docs/current/UI-UX-MANUAL-QA-CHECKLIST.md`  
**Backlog Target:** `/docs/current/UI-UX-POLISH-BACKLOG.md`

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
| F-001 |  |  |  |  |  |  |  |
| F-002 |  |  |  |  |  |  |  |
| F-003 |  |  |  |  |  |  |  |

## Sign-Off

- [ ] All P1 findings fixed and re-tested
- [ ] New findings copied to `/docs/current/UI-UX-POLISH-BACKLOG.md`
- [ ] Build green after fixes (`npm run lint`, `npm run build`)
