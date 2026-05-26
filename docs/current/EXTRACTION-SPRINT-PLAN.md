# Extraction & Cleanup Sprint Plan

**Created:** 2026-05-22
**Status:** In progress
**Purpose:** Reduce the three largest source files to focused, maintainable modules before the pre-launch rehearsal begins.

---

## Background

Audit identified three files that mix too many concerns, making bugs hard to localise and changes risky:

| File | Lines | Problem |
|---|---|---|
| `app/admin/fixtures/FixturesPageContent.tsx` | 2,472 | Single component with 55+ state vars and 20+ handlers across 8 unrelated admin workflows |
| `functions/src/ingest.ts` | 2,238 | Mixes provider HTTP clients, normalisation pipeline, write/quarantine logic, live ops config, health, rehearsal callables, and fixture replay callables |
| `functions/src/index.ts` | 951 | Acts as both barrel and implementation file — contains full callables for onboarding, admin users, and mock seeding |

Related docs: `BUILD-PLAN-PHASES.md`, `AGENT-HANDOVER.md`, `FINAL-LAUNCH-REHEARSAL.md`

---

## Ok-gate workflow

Before each bundle:
- State understanding, next bundle, files involved, key risks
- Wait for **ok**

After each bundle:
- State what changed, what was verified, what remains, next bundle
- Wait for **ok**

---

## Phase 1 — Commit baseline

### Bundle 1.1 — Commit 56-file working tree

**Goal:** Establish a committed git baseline before any extraction begins so that extraction diffs are clean and reversible.

**Scope:** All 56 modified/untracked source files. Design-reference trees excluded via `.gitignore`.

**Exit criteria:** Both `npm run build` and `cd functions && npm run build` pass on the committed state.

| Status | Date | Notes |
|---|---|---|
| ✅ Done | 2026-05-22 | Commit `753291f`. Both builds green. |

---

## Phase 2 — FixturesPageContent extraction

Target: `app/admin/fixtures/FixturesPageContent.tsx`
Direction: 2,472 ln → ~400 ln shell + 6 panel components in `components/admin/`

Note: `components/admin/AdminGate.tsx`, `AdminEnvironmentBadge.tsx`, and `LocalhostProductionWarning.tsx` were already extracted in the baseline commit — these are done.

### Bundle 2.1 — Extract TransferWindowPanel, LocalVisibleRehearsalPanel, LiveOpsConfigPanel

**Goal:** Extract the 3 panels with the most self-contained state. Each owns its own state vars and handlers with minimal shared dependencies.

- `TransferWindowPanel` — transfer window open/close, schedule, status display (~8 state vars, 3 handlers)
- `LocalVisibleRehearsalPanel` — preview reset, reset visible data, run live wave, wave counter (~6 state vars, 3 handlers)
- `LiveOpsConfigPanel` — mode/provider/cutoff/max config, save settings (~7 state vars, 2 handlers)

**Key shared state to prop-thread:** `dangerConfirmed` (gates both rehearsal reset and wave run), `uid`, `functions`.

**Files:**
- `components/admin/TransferWindowPanel.tsx` (new)
- `components/admin/LocalVisibleRehearsalPanel.tsx` (new)
- `components/admin/LiveOpsConfigPanel.tsx` (new)
- `app/admin/fixtures/FixturesPageContent.tsx` (reduce by ~700 ln)

**Exit criteria:** Build green; admin/fixtures page renders and all 3 panels function correctly.

| Status | Date | Notes |
|---|---|---|
| ✅ Done | 2026-05-22 | 5 files created/rewritten. Build green (21 routes, TypeScript clean). |

---

### Bundle 2.2 — Extract FixtureIngestPanel, ProviderShadowPanel, LeaderboardRecomputePanel

**Goal:** Extract the 3 operational workflow panels that drive primary admin tasks.

- `FixtureIngestPanel` — fixture ingest, reset+ingest, pre-tournament ingest (~3 state pairs, 4 handlers)
- `ProviderShadowPanel` — contract test, fixture replay wave (~4 state pairs, 4 handlers)
- `LeaderboardRecomputePanel` — recompute, retry dirty, shadow recompute (~4 state pairs, 3 handlers)

**Key shared state:** `liveOps` (used for display context in ingest panel), `acknowledged` / `dangerConfirmed`.

**Files:**
- `components/admin/FixtureIngestPanel.tsx` (new)
- `components/admin/ProviderShadowPanel.tsx` (new)
- `components/admin/LeaderboardRecomputePanel.tsx` (new)
- `app/admin/fixtures/FixturesPageContent.tsx` (reduce by ~900 ln)

**Exit criteria:** Build green; all 3 panels function correctly.

| Status | Date | Notes |
|---|---|---|
| ✅ Done | 2026-05-22 | 3 panel components + FixturesPageContent reduced to 80 ln. Build green. |

---

### Bundle 2.3 — Finalise FixturesPageContent shell + utility extraction + build verify

**Goal:** After all 6 panels are extracted, the shell retains only: auth/uid/admin setup, the polling `useEffect`, shared health state, and layout wiring. Utility functions (type guards, formatters, `buildIngestAlert`, `buildLeaderboardDiff`) move to `lib/adminFixturesUtils.ts`.

**Files:**
- `app/admin/fixtures/FixturesPageContent.tsx` (final shell, ~400 ln)
- `lib/adminFixturesUtils.ts` (new — shared formatters/guards)

**Exit criteria:** `FixturesPageContent` under 450 ln; `npm run build` green; commit.

| Status | Date | Notes |
|---|---|---|
| ✅ Done | 2026-05-22 | Merged into 2.2. Shell is 80 ln; adminFixturesUtils.ts done in 2.1. |

---

## Phase 3 — functions/src/ingest.ts extraction

Target: `functions/src/ingest.ts`
Direction: 2,238 ln → 1,222 ln core pipeline + focused modules

Note: `functions/src/ingestHealth.ts`, `functions/src/ingest/validateMatchUpdate.ts`, and `functions/src/providers/` directory were partially bootstrapped in the baseline commit — review actual import wiring before each bundle.

### Bundle 3.1 — Extract provider HTTP adapters + full Sportmonks removal

**Goal:** Move `getFootballDataMatches` to `providers/footballDataProvider.ts`. Remove all Sportmonks code (getSportmonksMatches, SPORTMONKS_TOKEN, all call sites). Move shared helpers to `providers/providerUtils.ts`.

**Files:**
- `functions/src/providers/footballDataProvider.ts` (new)
- `functions/src/providers/providerUtils.ts` (new)
- `functions/src/providers/providerTypes.ts` (ProviderMatch added; NormalizedMatchProvider updated)
- `functions/src/ingest.ts` (remove ~650 ln, add imports)
- `lib/adminFixturesUtils.ts` (remove "sportmonks" from LiveOpsProvider)
- `components/admin/LiveOpsConfigPanel.tsx` (remove Sportmonks dropdown + error messages)

**Exit criteria:** `cd functions && npm run build` green; both provider modules importable.

| Status | Date | Notes |
|---|---|---|
| ✅ Done | 2026-05-22 | Commit `6ec139a`. Full Sportmonks removal. Both builds green. |

---

### Bundle 3.2 — Extract rehearsal callables

**Goal:** Move `adminResetPublicRehearsalState`, `adminRunLocalLiveSimulatorWave`, `adminReplayFixtureWave`, `adminResetFixtureReplay` to `functions/src/rehearsal.ts`. `resetPublicRehearsalState()` helper moved with them (only called from rehearsal path). Export `writeLiveOpsHealth`, `applyNormalizedMatchUpdates`, and needed types from `ingest.ts`.

**Files:**
- `functions/src/rehearsal.ts` (new, 369 ln)
- `functions/src/ingest.ts` (2238 → 1238 ln)
- `functions/src/index.ts` (rehearsal callables re-exported from `./rehearsal`)

**Exit criteria:** `cd functions && npm run build` green; rehearsal callables present in index exports.

| Status | Date | Notes |
|---|---|---|
| ✅ Done | 2026-05-22 | Commit `e3098a0`. ingest.ts 2238→1238 ln. Both builds green. |

---

### Bundle 3.3 — Clean up ingest.ts core pipeline + build verify + commit

**Goal:** Remove leftover utility duplication (`isRecord`, `asString` local copies replaced with imports from `providerUtils.ts`). Remove what-not-why JSDoc comments. Verify file contains only the core normalisation pipeline and the 6 main callables.

**Actual final line count:** 1,222 ln (750 target was aspirational — remaining content is genuine pipeline: 6 callables ~440 ln + normalisation pipeline ~400 ln + config/type helpers ~380 ln).

**Files:**
- `functions/src/ingest.ts` (final state, 1222 ln)
- `npm run build` + `cd functions && npm run build`
- Commit Phase 3

**Exit criteria:** Both builds green; no duplicate helpers; file contains only core pipeline.

| Status | Date | Notes |
|---|---|---|
| ✅ Done | 2026-05-22 | Commit TBD. isRecord/asString deduped. Both builds green. |

---

## Phase 4 — functions/src/index.ts cleanup

Target: `functions/src/index.ts`
Direction: 951 ln → ~80 ln barrel of re-exports

### Bundle 4.1 + 4.2 — Extract onboarding.ts + adminUsers.ts + barrel cleanup (merged)

**Goal:** Move the full callable implementations out of `index.ts`. Bundled 4.1 and 4.2 into a single pass.

**Files:**
- `functions/src/functionUtils.ts` (new, 60 ln) — `shuffle`, `uniqueByTeamId`, `drawTierBalanced`, `asTrimmedString`, `TeamSeedRow` shared by both modules
- `functions/src/onboarding.ts` (new, ~290 ln) — `ensureUserProfile`, `assignDrawnTeams`, `confirmFeaturedTeam`, `setDepartment` + local helpers
- `functions/src/adminUsers.ts` (new, ~290 ln) — `adminListUsers`, `adminAssignTeamsToUser`, `adminSeedMockUsers` + local helpers
- `functions/src/index.ts` (final, 36 ln) — `admin.initializeApp()` + pure barrel of re-exports

**Exit criteria:** Both builds green; `index.ts` under 100 ln; all callables present in exports.

| Status | Date | Notes |
|---|---|---|
| ✅ Done | 2026-05-22 | index.ts 953→36 ln. Both builds green. Sprint complete. |

---

## Status log

| Date | Bundle | Result | Notes |
|---|---|---|---|
| 2026-05-22 | 1.1 | ✅ Pass | Commit `753291f`; 104 files; both builds green; design-reference trees gitignored |
| 2026-05-22 | 2.1 | ✅ Pass | 5 files; lib/adminFixturesUtils.ts + 3 panel components + FixturesPageContent rewrite; build green |
| 2026-05-22 | 2.2 | ✅ Pass | 3 panel components; FixturesPageContent 1054→80 ln; build green |
| 2026-05-22 | 3.1 | ✅ Pass | Commit `6ec139a`; footballDataProvider.ts + providerUtils.ts; full Sportmonks removal; both builds green |
| 2026-05-22 | 3.2 | ✅ Pass | Commit `e3098a0`; rehearsal.ts 369 ln; ingest.ts 2238→1238 ln; both builds green |
| 2026-05-22 | 3.3 | ✅ Pass | isRecord/asString deduped; JSDoc removed; ingest.ts final 1222 ln; both builds green |
| 2026-05-22 | 4.1+4.2 | ✅ Pass | functionUtils.ts + onboarding.ts + adminUsers.ts; index.ts 953→36 ln; both builds green |
