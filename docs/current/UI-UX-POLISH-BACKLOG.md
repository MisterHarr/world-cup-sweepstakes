# UI/UX Polish Backlog

**Last Updated:** 2026-02-18  
**Status:** Post-sprint backlog (driven by manual QA findings)

## Prioritization Rules

- `P1`: User-facing breakage, blocked flow, major mobile unreadability, or auth/admin risk
- `P2`: Noticeable UI inconsistency or usability friction without blocking flow
- `P3`: Visual polish and consistency improvements

## Backlog

| ID | Priority | Surface | Finding | Proposed Fix | Status |
|---|---|---|---|---|---|
| UX-001 | P1 | Shared headers | Header markup is duplicated across pages, causing mobile identity drift risk | Extract shared authenticated header component and reuse in dashboard/leaderboard/badges/transfer-history | Todo |
| UX-002 | P1 | Auth dialogs | Historical ARIA dialog warning risk during onboarding confirmations | Audit all dialogs for `DialogDescription`/`aria-describedby` consistency | Todo |
| UX-003 | P1 | Transfer market mobile | Dense market row data can still feel cramped on very narrow widths | Add a dedicated mobile row variant with explicit label/value rows and tighter spacing tokens | Todo |
| UX-004 | P2 | Leaderboard mobile | Podium structure can visually collapse on narrow widths in edge cases | Add breakpoint-specific podium sizing constraints and verify with 320-390px widths | Todo |
| UX-005 | P2 | Typography system | Multiple ad-hoc text size/weight combos across pages | Introduce shared typography utility classes/tokens for title, subtitle, stat, helper text | Todo |
| UX-006 | P2 | Badge data contract | Badge unlock data is parsed from multiple schema variants | Define and document a single canonical `users/{uid}.badges` schema | Todo |
| UX-007 | P3 | Microcopy consistency | Mixed label tone (`Signed in`, `Signed in as`, short name labels) | Standardize signed-in identity copy across breakpoints | Todo |
| UX-008 | P3 | Focus affordances | Some action areas have subtle focus contrast in dark gradients | Increase focus ring contrast and verify keyboard-only navigation pass | Todo |

## Seed Findings (Automated Pre-Pass)

**Run Date:** 2026-02-18  
**Commands:** `npm run build` (pass), `npm run lint` (pass after fixes)

| ID | Priority | Surface | Finding | Proposed Fix | Status |
|---|---|---|---|---|---|
| QA-001 | P1 | `components/OfflineIndicator.tsx` | Lint error: synchronous `setState` inside effect (`react-hooks/set-state-in-effect`) | Initialize online state lazily and keep effect only for subscriptions/events | Done |
| QA-002 | P1 | `components/dashboard/DashboardPortfolio.tsx` | Lint error: synchronous `setState` in effect for previous rank tracking | Replace with derived state/memo + guarded localStorage sync pattern | Done |
| QA-003 | P1 | `components/dashboard/DashboardTransferMarket.tsx` | Lint error: synchronous `setState` in effect during transfer execution | Refactor transfer-confirm flow to avoid direct state writes at effect start | Done |
| QA-004 | P2 | `components/dashboard/DashboardBracket.tsx` | Lint error: manual memoization preservation warning on `matches` dependency | Normalize/clone dependency input or simplify memoization path | Done |
| QA-005 | P2 | Tooling / repo hygiene | `npm run lint` scans reference UX docs folder and returns unrelated errors | Add lint ignore for `docs/sweepstakes-game-ux (1)` (reference-only artifacts) | Done |

## Intake From Manual QA

- Add new findings with route + viewport + reproduction steps.
- If issue affects auth, admin, or transfer execution, default to `P1` until triaged.
- Link each fix PR to its backlog ID.
