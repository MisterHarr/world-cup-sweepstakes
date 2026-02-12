# Rehearsal Log

Last updated: 2026-02-12

## Rehearsal 2026-02-12

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

Known limits:
- This rehearsal is emulator-based and cost-safe.
- Provider scheduling smoke remains controlled/short-window operational testing.
