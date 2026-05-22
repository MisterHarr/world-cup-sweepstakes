# Final Launch Rehearsal

Last updated: 2026-05-21

Use this document for the final operator rehearsal before enabling any real production ingest mode.

## Purpose

This is the last integrated proof step before sign-off. It should demonstrate that:

- the app is reachable
- the admin/operator surfaces are usable
- provider shadow mode is already proven
- replay/load behavior is rehearsed
- manual fallback is rehearsed
- transfer-critical behavior is rehearsed
- monitoring and go/no-go evidence are captured in one place

## Preconditions

Do not start this checklist unless all of the following are already true:

- [ ] Root app build passes
- [ ] Functions build passes
- [ ] No open Critical or High security findings
- [ ] `football-data.org` is the selected provider
- [ ] Provider shadow proof has already passed
- [ ] Admin account is available
- [ ] Local or target environment secrets are configured

Reference:

- [docs/current/PRODUCTION-GO-NO-GO-CHECKLIST.md](/Users/harrison.j/world-cup-sweepstakes-clean/docs/current/PRODUCTION-GO-NO-GO-CHECKLIST.md)
- [docs/current/BROWSER-EMULATOR-LAUNCH-SMOKE.md](/Users/harrison.j/world-cup-sweepstakes-clean/docs/current/BROWSER-EMULATOR-LAUNCH-SMOKE.md)
- [docs/current/TOURNAMENT-RUNBOOK.md](/Users/harrison.j/world-cup-sweepstakes-clean/docs/current/TOURNAMENT-RUNBOOK.md)

## Phase 1: Reachability and operator access

- [ ] App responds on the expected host/port
- [ ] Signed-in user can reach the normal app shell
- [ ] Non-admin is blocked from admin routes
- [ ] Admin can open `/admin/fixtures`
- [ ] Admin page shows:
  - [ ] environment badge
  - [ ] project id
  - [ ] localhost-production warning if applicable

## Phase 2: Browser/emulator smoke

Run:

- [ ] [docs/current/BROWSER-EMULATOR-LAUNCH-SMOKE.md](/Users/harrison.j/world-cup-sweepstakes-clean/docs/current/BROWSER-EMULATOR-LAUNCH-SMOKE.md)

Record:

- Core signed-in path result:
- Privacy result:
- Admin access result:
- Operator controls result:

## Phase 3: Replay / load rehearsal

Use the staged replay flow from the runbook.

- [ ] Mock users seeded for rehearsal
- [ ] Replay wave G1 run
- [ ] Replay wave G2 run
- [ ] Replay wave G3 run
- [ ] Leaderboard movement looked credible
- [ ] No unexpected quarantine spike
- [ ] No dirty-score state left unresolved

Scripted evidence captured on 2026-05-18:

- [x] Isolated emulator rehearsal suite passed via `npm run test:rehearsal`
- [x] Transfer regression passed
- [x] Transfer closed-window guardrail passed
- [x] Public squad privacy regression passed
- [x] Ingest validation quarantine regression passed
- [x] Shadow mode routing regression passed
- [x] Dirty recompute retry regression passed
- [ ] Manual browser-visible replay wave sign-off still pending

## Phase 4: Provider shadow / observability

- [ ] `football-data.org` remains selectable in `/admin/fixtures`
- [ ] Shadow contract test still succeeds
- [ ] `shadowMatches` updates
- [ ] `shadowLeaderboard/current` updates
- [ ] Health panels show:
  - [ ] ingest timestamps
  - [ ] recompute timestamps
  - [ ] provider
  - [ ] mode
  - [ ] no unexplained error

## Phase 5: Manual fallback drill

This phase proves that the system is operable even if automated/provider flow is disabled.

- [ ] Scheduler/automation set to safe state before drill
- [ ] Manual ingest path run
- [ ] Manual recompute path run
- [ ] Leaderboard timestamp changes as expected
- [ ] Operator can explain the fallback sequence from memory

Fallback sequence:

1. Open `/admin/fixtures`
2. Disable scheduler if noisy or unstable
3. Run manual ingest
4. Run leaderboard recompute
5. Validate dashboard / leaderboard pages

## Phase 5.1: Local visible fabricated-live rehearsal

This is the preferred local proof when you want to see the normal app move instead of only proving shadow collections.

- [ ] Admin opens `/admin/fixtures`
- [ ] `Local Visible Rehearsal` -> `Preview Reset` reviewed
- [ ] `Local Visible Rehearsal` -> `Reset Visible Data` run
- [ ] Users and entries are preserved
- [ ] Public `matches`, transfer events, team stats, user scores, and public leaderboard state are reset
- [ ] `Run Next Live Wave` applied until at least one `LIVE` or `FINISHED` wave
- [ ] `/dashboard` shows changed team scores or status
- [ ] `/leaderboard` shows score/rank movement
- [ ] Ingest and recompute health timestamps update without errors

## Phase 6: Transfer rehearsal

- [ ] Transfer window opened
- [ ] One valid transfer succeeds
- [ ] Duplicate or invalid transfer is blocked
- [ ] Remaining transfer count updates
- [ ] Transfer window closed again

## Phase 7: Alerting / incident readiness

- [ ] Monitoring alert procedure reviewed
- [ ] Synthetic alert test run or recent validated evidence attached
- [ ] Incident response owner identified
- [ ] Operator knows the “disable scheduler first” incident step

## Phase 8: Go / no-go capture

Complete:

- [ ] [docs/current/PRODUCTION-GO-NO-GO-CHECKLIST.md](/Users/harrison.j/world-cup-sweepstakes-clean/docs/current/PRODUCTION-GO-NO-GO-CHECKLIST.md)

Record final rehearsal summary:

- Date:
- Environment:
- Tester:
- Browser smoke result:
- Replay/load result:
- Provider shadow result:
- Manual fallback result:
- Transfer rehearsal result:
- Local visible fabricated-live result:
- Alerting result:
- Open issues:
- Go / no-go recommendation:

## Current known status before this rehearsal

- [x] App can be served locally on `http://localhost:3001`
- [x] Provider shadow proof already passed
- [x] Functions dependency High/Critical blockers were removed
- [x] Scripted isolated emulator rehearsal suite passed on 2026-05-18
- [ ] Browser smoke completion still needs to be recorded cleanly
- [ ] Replay/load rehearsal still needs explicit sign-off capture
- [ ] Manual fallback still needs explicit sign-off capture
- [ ] Local visible fabricated-live rehearsal still needs explicit sign-off capture
- [ ] Transfer rehearsal still needs explicit sign-off capture
- [ ] Monitoring alert still needs explicit sign-off capture
