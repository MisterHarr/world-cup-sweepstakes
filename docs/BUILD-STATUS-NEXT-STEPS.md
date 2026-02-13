# Build Status and Next Steps

Last updated: 2026-02-13

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
- External alerting is now live in Cloud Monitoring:
  - Alert policy: `projects/worldcup-sweepstake-2026/alertPolicies/8460958675161850743`
  - Notification channel: `projects/worldcup-sweepstake-2026/notificationChannels/5604417890488344253`
  - Synthetic incident verified at `2026-02-13T08:51:32Z`

## What Is Still Missing (Production-Critical)

- Final pre-tournament go-live checklist run with real participant data loaded.

## Next Best Build Step (Priority 1)

Run final pre-tournament operational sign-off with real participant data.

### Scope

1. Keep scheduler `DISABLED` and run full checklist in `docs/TOURNAMENT-RUNBOOK.md` section 8.
2. Confirm live fallback path works end-to-end:
   - disable automation
   - manual ingest
   - recompute
   - Board/Live validation
3. Verify transfer guardrails again with the two real user accounts.
4. Record sign-off date/time and operator in `docs/REHEARSAL-LOG.md`.

### Acceptance Criteria

- Pre-tournament checklist is completed against the real environment.
- Fallback and transfer flows are verified with current production settings.
- A dated sign-off entry is recorded in `docs/REHEARSAL-LOG.md`.

## Recommended Build Order After Priority 1

1. Final pre-tournament operational sign-off:
   - run runbook checklist with real participant data
   - confirm provider ingest window procedure
   - verify fallback path under incident conditions
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
