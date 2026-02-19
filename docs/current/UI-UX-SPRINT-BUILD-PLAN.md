# UI/UX Sprint Build Plan

**Last Updated:** 2026-02-18
**Owner:** Architecture + Engineering
**Scope:** Frontend UX overhaul with correctness safeguards

## Build Process (How we execute)

1. **Foundation before polish**
- Resolve correctness and global-shell consistency first.
- Do not start page-level polish until shared branding/nav behavior is stable.

2. **Small-step delivery**
- Each step is scoped to one surface or one cross-cutting concern.
- Every step ends with build verification (`npm run build` + `functions npm run build` if touched).

3. **No hidden regressions**
- Keep transfer/leaderboard/auth flows working while redesigning.
- Preserve callable contracts unless explicitly versioned.

4. **Documentation-as-control-plane**
- Track step status here and in `BUILD-STATUS-NEXT-STEPS.md`.
- Record decisions that affect all pages (branding, nav order, typography, spacing rules).

## Sprint Plan

### Sprint 1: Foundation + Correctness
1. **Step 1:** Lock branding inputs (final game name + copyright-safe logo asset + centralized branding config).
2. **Step 2:** Global shell consistency (name/logo usage, nav order, mobile signed-in visibility).
3. **Step 3:** Functional correctness fixes (department leaderboard filtering, reveal randomization audit, bracket live/stage signal validation).

### Sprint 2: Onboarding UX
1. Landing page simplification + typography upgrade.
2. Sign-up options expansion (Google + email/password flow).
3. Signed-in welcome-state simplification.
4. Department page simplification.
5. Featured-team selection UI overhaul.
6. Featured confirmation modal simplification.

### Sprint 3: Core Gameplay Surfaces
1. Reveal page emphasis (featured double-points clarity).
2. Dashboard portfolio layout overhaul.
3. Leaderboard visual cleanup + squad tray redesign.
4. Bracket tab text/layout cleanup.
5. Transfer tab layout migration to Light-Luxury structure (dark palette retained).

### Sprint 4: Badges + Final Polish
1. Premium badge visual system and rarity glows.
2. Badge filter tabs (`All`, `Common`, `Uncommon`, `Rare`, `Epic`, `Legendary`).
3. Always-visible badge catalog with locked state.
4. Final mobile and typography pass.

## Current Step

- **Completed:** Sprint 1, Step 1, Step 2, Step 3, Sprint 2 Step 1, Sprint 2 Step 2, Sprint 2 Step 4, Sprint 2 Step 5, Sprint 2 Step 6, Sprint 3 Step 1, Sprint 3 Step 2, Sprint 3 Step 3, Sprint 3 Step 4, Sprint 3 Step 5, Sprint 4 Step 1, Sprint 4 Step 2, Sprint 4 Step 3, and Sprint 4 Step 4
- **Next:** Re-test manual QA findings `F-001` to `F-009` using `/docs/current/UI-UX-MANUAL-QA-RUN-2026-02-18.md` and close sign-off.
- **Step 1 Definition of Done Met:**
  - Branding name finalized in one source file: `/lib/branding.ts`.
  - Logo asset local and copyright-safe: `/public/branding/featured-five-2026-mark.svg`.
  - App consumes branding config (legacy hardcoded naming removed from app surfaces).
- **Step 2 Outcomes:**
  - Transfer nav moved to end of global nav order.
  - Signed-in identity made visible on mobile in both shell variants.
  - Header spacing adjusted to avoid conflict with mobile nav toggle.
- **Step 3 Outcomes:**
  - Leaderboard department filtering hardened with normalized department parsing and callable-backed department fallback mapping.
  - Team draw randomization hardened to enforce unique team IDs in assignment paths.
  - Match Center stage/status parsing normalized for resilient live/stage signal behavior.
- **Sprint 2 Step 1 Outcomes:**
  - Landing/auth surface simplified to core content only (brand, logo, primary action).
  - Signed-in state simplified to `Welcome [name]!` plus only `Continue` and `Sign Out`.
  - Headline typography tightened for clearer hierarchy and cleaner first impression.
- **Sprint 2 Step 2 Outcomes:**
  - Added dual auth entry modes on landing (`Google` and `Email`).
  - Added email/password account creation and email/password sign-in flow.
  - Added auth error normalization for common email/password failure states.
- **Sprint 2 Step 4 Outcomes:**
  - Simplified `/department` UI to three large centered options (`Primary`, `Secondary`, `Ops/Admin`).
  - Removed secondary helper copy and path/debug-style footer text from department selection.
  - Increased confirmation CTA emphasis while preserving one-time department write behavior.
- **Sprint 2 Step 5 Outcomes:**
  - Reworked featured-team cards to a compact horizontal layout (flag/name left, group+tier right).
  - Upgraded tier badge styling to a more premium tile treatment.
  - Expanded group filters to use full available groups (including A-L coverage, no hard slice).
  - Increased headline hierarchy and double-points emphasis on `/featured-team`.
- **Sprint 2 Step 6 Outcomes:**
  - Simplified featured confirmation modal copy and hierarchy for faster comprehension.
  - Removed decorative icon and mystery-teams filler copy.
  - Increased emphasis on featured team identity and 2x points note with a cleaner reveal CTA.
- **Sprint 3 Step 1 Outcomes:**
  - Reworked `/reveal` headline hierarchy and removed decorative intro icon noise.
  - Added stronger featured-team differentiation (`Featured · 2x` badge, highlighted featured card treatment).
  - Increased flag/name/code scale on reveal cards and removed the low-value tier explanation block.
- **Sprint 3 Step 2 Outcomes:**
  - Rebuilt portfolio summary into nested containers: large total-points panel + dedicated rank-trend card.
  - Added rank movement indicator (up/down/no-change) based on previously seen rank for the signed-in user.
  - Reworked team rows and expanded panels into clearer nested card sections with premium tier badges.
  - Removed `Your Pick` label and shifted featured signaling to crown + `Featured 2x` badge treatment.
- **Sprint 3 Step 3 Outcomes:**
  - Removed redundant leaderboard top heading/meta strip (`Leaderboard`, participant count, standalone chip).
  - Kept podium-first hierarchy while cleaning visual noise in the list and tab area.
  - Redesigned squad drawer cards with larger flags, premium tier tiles, simplified ID display, and nested contribution container.
  - Removed group/label clutter inside squad tray cards to improve scanability.
- **Sprint 3 Step 4 Outcomes:**
  - Removed bracket-tab debug/meta clutter (`Last updated`, `v0 layout active`, and `Current Stage` label chrome).
  - Re-centered and scaled the `Match Center` header and live match signal for stronger hierarchy.
  - Kept match-live counts and stage navigation dynamic while reducing visual noise in the bracket header.
- **Sprint 3 Step 5 Outcomes:**
  - Migrated Transfer tab to a Light-Luxury-inspired structure in dark theme: two-step selection flow + sticky transfer summary panel.
  - Reworked market list into denser table-like rows with clearer selection affordances and trend/points scanability.
  - Preserved hold-to-confirm transfer execution, window/open-state gating, and transfer-history access while modernizing layout.
- **Sprint 4 Step 1 Outcomes:**
  - Introduced premium rarity visual tokens for the badges surface (color gradients, elevated borders, and rarity-specific glow shadows).
  - Upgraded the badge page header, progress panel, and rarity legend with stronger hierarchy and luxury-style card treatment.
  - Refreshed badge cards and empty-state presentation to align with the new premium visual system while keeping existing unlock logic unchanged.
- **Sprint 4 Step 2 Outcomes:**
  - Added badge rarity filter tabs on `/badges`: `All`, `Common`, `Uncommon`, `Rare`, `Epic`, `Legendary`.
  - Wired tab state to render filtered badge cards with per-tab counts and an empty filtered-view message.
  - Kept filtering behavior responsive on mobile via horizontal scrollable tab treatment.
- **Sprint 4 Step 3 Outcomes:**
  - Replaced empty-state-only badge rendering with an always-visible catalog sourced from `lib/badgeDefinitions.ts`.
  - Added locked/unlocked card-state behavior so all badges appear immediately and brighten when earned.
  - Wired user-doc badge data parsing on `/badges` to reflect unlocked badges and unlocked dates when present.
- **Sprint 4 Step 4 Outcomes:**
  - Applied global typography polish (stronger heading/body hierarchy and tracking consistency) without network-dependent font fetches.
  - Improved mobile signed-in identity visibility across shared headers by showing concise mobile name labels and fuller desktop labels.
  - Tightened transfer-market mobile row layout for clearer trend/points/action readability on narrow screens.
- **Post-Sprint Control Artifacts:**
  - Manual QA checklist: `/docs/current/UI-UX-MANUAL-QA-CHECKLIST.md`.
  - Polish backlog and priority queue: `/docs/current/UI-UX-POLISH-BACKLOG.md`.
- **Post-Sprint P1 Hardening Outcomes:**
  - Cleared `QA-001`, `QA-002`, and `QA-003` by removing synchronous set-state-in-effect patterns in offline status, portfolio rank tracking, and transfer execution flow.
  - Verified fixes with targeted lint on affected files and a passing production build.
- **Post-Sprint P2 Hardening Outcomes:**
  - Cleared `QA-004` by removing unstable manual memoization around `matches` in `/components/dashboard/DashboardBracket.tsx`.
  - Cleared `QA-005` by excluding `/docs/sweepstakes-game-ux (1)` from lint scope as reference-only material.
  - Verified lint now runs without errors and production build remains green.
- **Manual QA Findings Slice Outcomes (`F-001` to `F-007`):**
  - Hardened email-auth UX for existing-account sign-up attempts and reduced noisy expected auth logging.
  - Stabilized offline indicator behavior to avoid false persistent offline state.
  - Improved reveal CTA language/placement and small-screen card density.
  - Compacted dashboard team expansion layout on mobile and reorganized squad drawer cards for clearer hierarchy.
  - Simplified badge taxonomy/controls by promoting `common` display into `uncommon` and removing duplicate rarity legend controls.
- **Manual QA Reliability Follow-up Outcomes (`F-008` to `F-009`):**
  - Removed transfer-confirm runtime state-update regression by shifting trade execution outside state updater callbacks.
  - Hardened leaderboard row-id parsing and added current-user local score/squad fallback when remote row/schema data is inconsistent.
- **Note on Sprint 2 Step 3:**
  - Signed-in welcome-state simplification was delivered as part of Sprint 2 Step 1.
