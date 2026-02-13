# Build Status and Next Steps

Last updated: 2026-02-12

## Current Build Status

The app is now in a stable pre-production state for cost-safe testing:

Rehearsal command available: `npm run test:rehearsal` (emulator-only, zero-cost).

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
- Controlled provider smoke sign-off is completed and automation was returned to `DISABLED`.
- Ingest health telemetry is now written by scheduler runs:
  - `lastSuccessAt`
  - `lastErrorAt`
  - `lastErrorMessage`
  - `lastRunAt`, `lastRunProvider`, `lastRunMatches`, `lastRunUpdated`
- Ingest observability now includes:
  - `lastRunStatus` (`success`/`error`)
  - `consecutiveFailures`
  - `recentRuns` history (capped)
- Admin UI now shows ingest health alert state in `/admin/fixtures`:
  - `Healthy`
  - `Warning`
  - `Critical`
  - stale scheduler signal detection
- Duplicate `setGlobalOptions(...)` startup warning was removed from deployed Functions.
- Transfer backend is live (`executeTransfer`) with:
  - transfer-window enforcement
  - remaining-transfer checks
  - atomic roster update + transfer audit event
  - post-transfer leaderboard recompute call
- Transfer penalty scoring is integrated in recompute (`transferPenaltyPoints` from `transferEvents`).
- Dashboard transfer tab is wired to live callable + live transfer-window state.
- Dashboard and Badges now share one nav source (`lib/mainNav.ts`) for consistent UX labels/order.
- Tournament runbook includes a production readiness sign-off checklist.

## What Is Still Missing (Production-Critical)

- External alerting integration for ingest failures (email/Slack/PagerDuty), beyond in-app admin monitoring.
- Final pre-tournament go-live checklist run with real participant data loaded.

## Next Best Build Step (Priority 1)

External alerting integration for ingest failures.

### Scope

1. Add Cloud Logging filter and alert policy definition for repeated `ingestLiveScores` failures.
2. Configure at least one notification destination (email is acceptable baseline).
3. Add a short "alert test" procedure to the runbook.
4. Record alert policy IDs/links in docs for handover continuity.

### Acceptance Criteria

- Ingest failure signal reaches an operator without requiring dashboard polling.
- Operator can detect and react to bad ingest runs within minutes.
- Alert setup is documented with a repeatable test procedure.

## Recommended Build Order After Priority 1

1. External alerting and on-call wiring:
   - failure alert policy
   - notification channel
   - test-and-ack procedure
2. UX finish pass:
   - responsive QA
   - accessibility
   - performance pass on dashboard and match center.

## Cost Guardrail Policy

- Keep scheduler `DISABLED` outside tournament operations.
- Use fixture mode for dev verification.
- Enable provider mode only for controlled windows.
- Disable immediately post-tournament.

Rehearsal log: `docs/REHEARSAL-LOG.md`.
