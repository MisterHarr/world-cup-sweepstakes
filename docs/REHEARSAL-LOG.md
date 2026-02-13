# Rehearsal Log

Last updated: 2026-02-13

## Emulator Rehearsal 2026-02-12

Command:

```bash
npm run test:rehearsal
```

Result: PASS

## Pre-Tournament Operational Sign-Off 2026-02-13 (Current User Set)

Environment state before checks:
- Scheduler: `DISABLED`
- Provider configured: `provider`
- Ingest health: last run success, no current errors

Fallback drill evidence:
- Manual fixture ingest: `✅ Ingested 12 matches, updated 0. Leaderboard recomputed.`
- Manual recompute: `✅ Recomputed for 2 users (15 matches).`
- Leaderboard status timestamp: `2026-02-13T09:29:12.519Z`

Transfer guardrail evidence:
- Transfer window opened for test and then closed.
- Valid transfer succeeded:
  - `penaltyDelta: 15`
  - `transfersDelta: -1`
- Invalid second transfer attempt blocked:
  - `code: functions/failed-precondition`
  - `message: You can only drop one of your drawn teams.`

Safe reset evidence:
- `transferWindow disabled` confirmed after test.
- Scheduler remained `DISABLED`.

Result: PASS (for current registered users: 2)

Follow-up (UI polish):
- Transfer CTA button has low text contrast when active; track fix before production launch.

Evidence:
- PASS: executeTransfer + recompute regression test succeeded.
- PASS: transfer window closed guardrail regression test succeeded.
- PASS: getSquadDetails authz regression test succeeded.

Scope covered:
- Transfer success path and leaderboard recompute
- Transfer-window guardrail
- Squad privacy/authz guardrail (non-admin blocked, admin allowed)

## UI Contrast Checkpoint 2026-02-13

Scope:
- Transfer CTA active-state text contrast/readability fix in `/app/dashboard/page.tsx`.

Git evidence:
- Commit: `66a3825` (`fix(ui): improve transfer CTA contrast in transfer window active state`)
- PR: `https://github.com/MisterHarr/world-cup-sweepstakes/pull/1`
- Merge commit on `main`: `1eeed54`

Quality gate evidence:
- `npm run lint` -> PASS (warnings-only baseline, 0 errors)
- `npm run build` -> PASS
- `(cd functions && npm run build)` -> PASS
- `npm run test:rehearsal` -> PASS
  - PASS: executeTransfer + recompute regression test
  - PASS: transfer window closed guardrail regression test
  - PASS: getSquadDetails authz regression test

Result: PASS

## Pre-Tournament Operational Sign-Off 2026-02-13 (Expanded Participant Set)

Goal:
- Rerun final pre-tournament checklist after onboarding grew beyond the initial 2-user set.

Participant set:
- Total users: 5
- Temporary seeded users were added for this rehearsal window.

Environment state before checks:
- Scheduler / liveOps: `DISABLED` (`settings/liveOps.enabled=false`)
- Transfer window: disabled (`settings/transferWindow.enabled=false`)

Fallback drill evidence (fixture mode):
- Preview Reset (`maxMatches=12`): `willDelete=12`, `willIngest=12`
- Reset + Ingest (`maxMatches=12`): `deleted=12`, `ingested=12`, `updated=12`
- Recompute: `✅ Recomputed for 5 users (15 matches).`
- Leaderboard status timestamp: `2026-02-13T13:11:22.440Z`
- Leaderboard rows: 5

Transfer guardrail evidence:
- Transfer window opened for test and then closed.
- Valid transfer succeeded:
  - `remainingTransfers: 2`
  - `leaderboardRecomputed: true`
- Invalid transfer attempt blocked (drop featured):
  - `code: functions/failed-precondition`
  - `message: Featured team cannot be transferred.`
- Invalid transfer attempt blocked (window closed):
  - `code: functions/failed-precondition`
  - `message: Transfer window is closed.`

Safe reset evidence:
- `transferWindow disabled` confirmed after test.
- Scheduler remained `DISABLED`.

Result: PASS (expanded participant set: 5)

## Provider Smoke Sign-Off 2026-02-12 (Controlled Window)

Configuration:
- Automation: ENABLED
- Provider: `provider` (production)
- Fixture max matches cap: `3`

Observed provider cycles:
- `2026-02-12T14:52:05.290Z` -> success, provider, `m:3 u:0`
- `2026-02-12T15:02:04.835Z` -> success, provider, `m:3 u:0`

Shutdown evidence:
- Automation returned to DISABLED at `2026-02-12T15:11:26.607Z`.
- Last run remained success with provider health stable.

Result: PASS

Known limits:
- Rehearsal coverage is emulator-first plus a short production-provider smoke window.
- Keep provider automation disabled outside controlled tournament windows.

## External Alerting Smoke 2026-02-13 (Cloud Monitoring)

Policy:
- `projects/worldcup-sweepstake-2026/alertPolicies/8460958675161850743`

Notification channel:
- `projects/worldcup-sweepstake-2026/notificationChannels/5604417890488344253`
- Email: `jason.harrison855@gmail.com`

Test:
- Synthetic error emitted using `gcloud logging write ingestLiveScores-test ...`.
- Incident opened and email notification received.

Evidence:
- Incident opened at `2026-02-13T08:51:32Z`.
- Alert policy `World Cup ingestLiveScores failures` in `Enabled` state.

Result: PASS
