# Rehearsal Log

Last updated: 2026-02-13

## Emulator Rehearsal 2026-02-12

Command:

```bash
npm run test:rehearsal
```

Result: PASS

Evidence:
- PASS: executeTransfer + recompute regression test succeeded.
- PASS: transfer window closed guardrail regression test succeeded.
- PASS: getSquadDetails authz regression test succeeded.

Scope covered:
- Transfer success path and leaderboard recompute
- Transfer-window guardrail
- Squad privacy/authz guardrail (non-admin blocked, admin allowed)

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
