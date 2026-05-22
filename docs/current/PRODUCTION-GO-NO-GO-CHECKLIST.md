# Production Go / No-Go Checklist

Last updated: 2026-05-21

Use this as the final release gate before enabling production scheduler automation for World Cup 2026.

## Build and release state

| Check | Status | Notes |
|---|---|---|
| Root build green (`npm run build`) | Done | Passed on 2026-05-16 after the Next/Firebase upgrade pass. |
| Functions build green (`cd functions && npm run build`) | Done | Passed on 2026-05-16 after Functions dependency upgrades. |
| `npm audit --omit=dev` reviewed for app | Done | Re-run on 2026-05-16; see [`docs/current/DEPENDENCY-AUDIT-2026-05-16.md`](/Users/harrison.j/world-cup-sweepstakes-clean/docs/current/DEPENDENCY-AUDIT-2026-05-16.md). |
| `npm audit --omit=dev` reviewed for functions | Done | Re-run on 2026-05-16; see [`docs/current/DEPENDENCY-AUDIT-2026-05-16.md`](/Users/harrison.j/world-cup-sweepstakes-clean/docs/current/DEPENDENCY-AUDIT-2026-05-16.md). |
| No open Critical or High security findings | Done | Verified on 2026-05-16: root app and Functions audit state now have no remaining High/Critical findings. |
| Medium findings fixed or explicitly accepted | Pending | Root app still has the moderate Next/PostCSS-linked finding `RH-001`; explicit acceptance or upstream fix is still needed. |

## Firebase deploy surface

| Check | Status | Notes |
|---|---|---|
| Firestore rules deployed | Pending | Source: [`firestore.rules`](/Users/harrison.j/world-cup-sweepstakes-clean/firestore.rules). Deploy and verify in target project. |
| Firestore indexes deployed | Pending | Source: [`firestore.indexes.json`](/Users/harrison.j/world-cup-sweepstakes-clean/firestore.indexes.json). Deploy and verify in target project. |
| Functions deploy candidate built from current sources | Pending | No deploy in this repo pass; verify from release branch/candidate. |
| Report-only CSP enabled in app shell | Done | Added in [`next.config.ts`](/Users/harrison.j/world-cup-sweepstakes-clean/next.config.ts); keep report-only until reports are clean. |

## Provider and ingest readiness

| Check | Status | Notes |
|---|---|---|
| Chosen provider token set in secure runtime | Pending | `football-data.org` is selected, but production/runtime secret presence must be verified in the target environment. |
| `football-data.org` shadow mode passed | Done | Local script proof, local emulator rehearsal, and browser/admin shadow rehearsal all passed on 2026-05-15. |
| Production shadow mode passed | Pending | Must be run in the real production environment before enabling production writes. |
| Unknown team IDs rejected before match writes | Done | Validation gate and quarantine are in place. |
| Dirty-score recovery and retry path exists | Done | Public dirty-state and admin retry flow are implemented. |

## Operator readiness

| Check | Status | Notes |
|---|---|---|
| Admin runbook pass completed | Pending | Run through [`docs/current/TOURNAMENT-RUNBOOK.md`](/Users/harrison.j/world-cup-sweepstakes-clean/docs/current/TOURNAMENT-RUNBOOK.md) against the release candidate. |
| Transfer test passed | Pending | Verify one valid transfer, one blocked duplicate transfer, and remaining transfer decrement. |
| Manual fallback tested | Pending | Must rehearse `Run Fixture Ingest` + `Recompute Leaderboard` fallback. |
| Local visible fabricated-live rehearsal tested | Pending | Use `/admin/fixtures` -> `Local Visible Rehearsal` to reset public local data while preserving users, then run simulator waves and verify dashboard/leaderboard movement. |
| Monitoring alert tested | Pending | Use the Cloud Monitoring procedure in [`docs/current/TOURNAMENT-RUNBOOK.md`](/Users/harrison.j/world-cup-sweepstakes-clean/docs/current/TOURNAMENT-RUNBOOK.md#10-external-alerting-setup-cloud-monitoring). |
| Browser/emulator smoke suite passed | Pending | Scripted isolated emulator suite passed on 2026-05-18, but browser/operator checklist items are still pending in [`docs/current/BROWSER-EMULATOR-LAUNCH-SMOKE.md`](/Users/harrison.j/world-cup-sweepstakes-clean/docs/current/BROWSER-EMULATOR-LAUNCH-SMOKE.md). |
| Final launch rehearsal completed | Pending | Scripted rehearsal evidence is now captured in [`docs/current/FINAL-LAUNCH-REHEARSAL.md`](/Users/harrison.j/world-cup-sweepstakes-clean/docs/current/FINAL-LAUNCH-REHEARSAL.md), but manual browser, fallback, transfer, and alerting sign-off are still outstanding. |

## Sign-off

| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| Product / operator |  |  |  |  |
| Engineering |  |  |  |  |
