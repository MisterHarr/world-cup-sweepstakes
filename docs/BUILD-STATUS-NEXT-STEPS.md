# Build Status and Next Steps

Last updated: 2026-02-12

## Current Build Status

The app is now in a stable pre-production state for cost-safe testing:

- Firebase auth + admin claims are active.
- Firestore rules are deployed and enforcing admin writes.
- Dashboard Board/Live routes are mapped correctly.
- V0-style Board and Live layouts are active.
- Admin tools exist for:
  - fixture ingest
  - deterministic reset + ingest
  - leaderboard recompute
  - scheduler automation toggle
- Scheduler automation is deployed and gated by settings.
- Default live-ops state is cost-safe (`DISABLED`).
- Tournament runbook is available in-app at `/admin/runbook`.
- Provider ingestion path is implemented (Football-Data adapter in Functions).
- `FOOTBALL_DATA_TOKEN` is configured in Firebase Secret Manager.
- Controlled provider smoke test is completed (multiple scheduler cycles) and automation was returned to `DISABLED`.
- Ingest health telemetry is now written by scheduler runs:
  - `lastSuccessAt`
  - `lastErrorAt`
  - `lastErrorMessage`
  - `lastRunAt`, `lastRunProvider`, `lastRunMatches`, `lastRunUpdated`
- Ingest observability now includes:
  - `lastRunStatus` (`success`/`error`)
  - `consecutiveFailures`
  - `recentRuns` history (capped)
- Admin UI now shows ingest health in `/admin/fixtures`.
- Duplicate `setGlobalOptions(...)` startup warning was removed from deployed Functions.
- Transfer backend is live (`executeTransfer`) with:
  - transfer-window enforcement
  - remaining-transfer checks
  - atomic roster update + transfer audit event
  - post-transfer leaderboard recompute call
- Transfer penalty scoring is integrated in recompute (`transferPenaltyPoints` from `transferEvents`).
- Dashboard transfer tab is wired to live callable + live transfer-window state.
- Dashboard and Badges now share one nav source (`lib/mainNav.ts`) for consistent UX labels/order.
- Tournament runbook now includes a production readiness sign-off checklist.

## What Is Still Missing (Production-Critical)

Production operational hardening is still required.

- Provider plan decision for true live scoring during tournament windows.
- Ops alerting/monitoring for ingest failures (beyond manual admin checks).
- Full tournament rehearsal with final scoring config and transfer rules.

## Next Best Build Step (Priority 1)

Production observability and ops hardening.

### Scope

1. Add alerting for ingest failures and repeated scheduler errors.
2. Add a small admin-facing ops status card for provider health trend (last N runs).
3. Add a final end-to-end rehearsal checklist run for:
   - provider mode (short controlled window)
   - transfer flow
   - leaderboard/live UI refresh behavior
4. Capture final rollback steps in runbook (disable automation + manual fallback).

### Acceptance Criteria

- Ingest failure signal is visible without needing to manually inspect raw logs.
- Operator can detect and react to bad ingest runs within minutes.
- Rehearsal run produces a documented pass/fail result for go-live decision.

## Recommended Build Order After Priority 1

1. Production observability:
   - error-rate alarms
   - ingest success/failure counters
   - admin-facing health summary
2. UX finish pass:
   - responsive QA
   - accessibility
   - performance pass on dashboard and match center.

## Cost Guardrail Policy

- Keep scheduler `DISABLED` outside tournament operations.
- Use fixture mode for dev verification.
- Enable provider mode only for controlled windows.
- Disable immediately post-tournament.
