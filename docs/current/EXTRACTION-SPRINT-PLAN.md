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
| ☐ Pending | — | — |

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
| ☐ Pending | — | — |

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
| ☐ Pending | — | — |

---

### Bundle 2.3 — Finalise FixturesPageContent shell + utility extraction + build verify

**Goal:** After all 6 panels are extracted, the shell retains only: auth/uid/admin setup, the polling `useEffect`, shared health state, and layout wiring. Utility functions (type guards, formatters, `buildIngestAlert`, `buildLeaderboardDiff`) move to `lib/adminFixturesUtils.ts`.

**Files:**
- `app/admin/fixtures/FixturesPageContent.tsx` (final shell, ~400 ln)
- `lib/adminFixturesUtils.ts` (new — shared formatters/guards)

**Exit criteria:** `FixturesPageContent` under 450 ln; `npm run build` green; commit.

| Status | Date | Notes |
|---|---|---|
| ☐ Pending | — | — |

---

## Phase 3 — functions/src/ingest.ts extraction

Target: `functions/src/ingest.ts`
Direction: 2,238 ln → ~650 ln core pipeline + focused modules

Note: `functions/src/ingestHealth.ts`, `functions/src/ingest/validateMatchUpdate.ts`, and `functions/src/providers/` directory were partially bootstrapped in the baseline commit — review actual import wiring before each bundle.

### Bundle 3.1 — Extract provider HTTP adapters

**Goal:** Move `getFootballDataMatches` and `getSportmonksMatches` (fully self-contained HTTP clients) to dedicated provider files. The `providers/` directory already exists with `providerTypes.ts`, `localLiveSimulatorProvider.ts`, and `fixtureReplayProvider.ts`.

**Decision point:** Shared private helpers (`fetchJsonWithRetry`, status/stage mappers) — identify which are provider-specific vs shared; provider-specific helpers move with their provider, shared helpers move to `providers/providerUtils.ts`.

**Files:**
- `functions/src/providers/footballDataProvider.ts` (new or complete if scaffolded)
- `functions/src/providers/sportmonksProvider.ts` (new)
- `functions/src/ingest.ts` (remove ~450 ln, add imports)

**Exit criteria:** `cd functions && npm run build` green; both provider modules importable.

| Status | Date | Notes |
|---|---|---|
| ☐ Pending | — | — |

---

### Bundle 3.2 — Extract rehearsal callables + complete ingestHealth wiring

**Goal:** Move `adminResetPublicRehearsalState`, `adminRunLocalLiveSimulatorWave`, `adminReplayFixtureWave`, `adminResetFixtureReplay` to `functions/src/rehearsal.ts`. Confirm `ingestHealth.ts` is fully wired (already created — verify imports and re-exports in `index.ts`).

**Constraint:** `resetPublicRehearsalState()` internal helper — if it is called by both the rehearsal callable and any ingest path, keep the helper in `ingest.ts` and import it from `rehearsal.ts`, rather than moving it entirely.

**Files:**
- `functions/src/rehearsal.ts` (new)
- `functions/src/ingestHealth.ts` (verify/complete)
- `functions/src/ingest.ts` (remove ~400 ln)
- `functions/src/index.ts` (add re-exports for rehearsal callables)

**Exit criteria:** `cd functions && npm run build` green; rehearsal callables present in index exports.

| Status | Date | Notes |
|---|---|---|
| ☐ Pending | — | — |

---

### Bundle 3.3 — Clean up ingest.ts core pipeline + build verify + commit

**Goal:** Final pass on `ingest.ts` — remove leftover utility duplication, verify all imports resolve, confirm file contains only the core normalisation pipeline and the main `adminIngest` callable family.

**Files:**
- `functions/src/ingest.ts` (final state, ~650 ln)
- `npm run build` + `cd functions && npm run build`
- Commit Phase 3

**Exit criteria:** `ingest.ts` under 750 ln; both builds green.

| Status | Date | Notes |
|---|---|---|
| ☐ Pending | — | — |

---

## Phase 4 — functions/src/index.ts cleanup

Target: `functions/src/index.ts`
Direction: 951 ln → ~80 ln barrel of re-exports

### Bundle 4.1 — Extract onboarding.ts + adminUsers.ts

**Goal:** Move the full callable implementations out of `index.ts`:
- `functions/src/onboarding.ts` — `ensureUserProfile`, `assignDrawnTeams`, `confirmFeaturedTeam`, `setDepartment` (~460 ln)
- `functions/src/adminUsers.ts` — `adminListUsers`, `adminAssignTeamsToUser`, `adminSeedMockUsers` (~350 ln)

**Shared helpers in index.ts to resolve first:** `drawTierBalanced`, `buildUserBootstrapPatch`, `sanitizeSeedToken`, type guards — determine which belong to `onboarding.ts`, which to `adminUsers.ts`, and which are shared enough to warrant `functions/src/functionUtils.ts`.

**Files:**
- `functions/src/onboarding.ts` (new)
- `functions/src/adminUsers.ts` (new)
- `functions/src/index.ts` (implementations replaced by re-exports)

**Exit criteria:** `cd functions && npm run build` green; no implementation code left in `index.ts`.

| Status | Date | Notes |
|---|---|---|
| ☐ Pending | — | — |

---

### Bundle 4.2 — Final index.ts barrel cleanup + full build verify + commit

**Goal:** Confirm `index.ts` is ~80 ln of re-exports only. Remove any dead imports or helpers. Run both builds. Commit the completed extraction sprint.

**Final check:** Confirm all callable names are still present in `index.ts` exports so `firebase deploy --only functions` picks them all up.

**Files:**
- `functions/src/index.ts` (final state, ~80 ln)
- `npm run build` (root) + `cd functions && npm run build`
- Commit Phase 4 + sprint closeout

**Exit criteria:** Both builds green; `index.ts` under 100 ln; extraction sprint closed.

| Status | Date | Notes |
|---|---|---|
| ☐ Pending | — | — |

---

## Status log

| Date | Bundle | Result | Notes |
|---|---|---|---|
| — | — | — | — |
