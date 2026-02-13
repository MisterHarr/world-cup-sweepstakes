# Rehearsal Log

Last updated: 2026-02-12

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
