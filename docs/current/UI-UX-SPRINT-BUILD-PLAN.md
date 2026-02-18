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

- **Completed:** Sprint 1, Step 1, Step 2, Step 3, Sprint 2 Step 1, Sprint 2 Step 2, and Sprint 2 Step 4
- **Next:** Sprint 2, Step 5 (featured-team selection UI overhaul)
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
- **Note on Sprint 2 Step 3:**
  - Signed-in welcome-state simplification was delivered as part of Sprint 2 Step 1.
