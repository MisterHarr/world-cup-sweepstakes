# Production Readiness Sprint Checklist

Last updated: 2026-05-21

## Sprint 0 — Baseline verification and branch discipline

| Item | Status | Notes |
|---|---|---|
| Root build passes | Done | `npm run build` passed on 2026-05-14 after Sprint 1 changes. |
| Functions build passes | Done | `cd functions && npm run build` passed on 2026-05-14 after Sprint 3 changes. |
| `npm audit --omit=dev` reviewed | Pending | Not run in this pass. |
| Helper files present: `lib/firebase.ts`, `lib/googleAuth.ts`, `lib/userBootstrap.ts`, `lib/useAuthGuard.ts` | Done | Verified during read-through. |
| `lib/firebase.ts` uses `getFunctions(app, "asia-southeast1")` | Done | Confirmed. |
| Current audit findings copied into checklist | Done | This file tracks Sprint 0 and Sprint 1 status. |
| No production deployment from this sprint | Done | No deploy work performed. |

## Sprint 1 — Environment and admin safety

| Item | Status | Notes |
|---|---|---|
| Shared `components/admin/AdminGate.tsx` exists | Done | Added with consistent loading, signed-out, denied, and error states. |
| Admin pages use shared `AdminGate` | Done | Applied to `/admin`, `/admin/fixtures`, `/admin/seed-teams`, `/admin/users`, `/admin/runbook`. |
| Environment badge shows `LOCAL / STAGING / PRODUCTION` | Done | Added shared `AdminEnvironmentBadge`. |
| Environment badge shows Firebase project id | Done | Reads `NEXT_PUBLIC_FIREBASE_PROJECT_ID`. |
| Environment badge shows app mode | Done | Heuristic mode shown as `shadow`, `staging`, or `production`. |
| Localhost + production project warning added | Done | Added shared `LocalhostProductionWarning`. |
| Destructive admin actions blocked until `PRODUCTION` is typed when running localhost against production | Done | Applied to seed, delete, assign, mock seed, ingest, recompute, and settings writes. |
| Signed-out redirect uses `/` instead of `/login` | Done | Updated `lib/useAuthGuard.ts`, `components/AuthSignedOutRedirect.tsx`, and `app/department/page.tsx`. |
| Admin pages clearly expose environment/project metadata | Done | Visible in page header on admin routes covered by this sprint. |

## Known next gaps

| Sprint | Item | Status |
|---|---|---|
| Sprint 2 | Remove public email fallback from `getSquadDetails` | Done |
| Sprint 2 | Add user bootstrap fallback telemetry | Done |
| Sprint 3 | Provider-independent ingest validation + quarantine | Done |
| Sprint 3 | Explicit `liveOps.mode` with shadow/staging routing | Done |
| Sprint 3 | Shadow recompute writes to `shadowLeaderboard/current` | Done |
| Sprint 3 | Admin can run shadow recompute and inspect divergence | Done |
| Sprint 3 | Emulator coverage added for validation, shadow routing, and dirty retry | Done |
| Sprint 4 | Dirty-score state and recompute retry path | Done |
| Sprint 5 | Mock-user controls and orphan-team safety | Done |
| Sprint 7 | Provider evidence matrix and recommendation | Done |
| Sprint 7 | Sportmonks trial adapter wired into ingest | Done |
| Sprint 7 | Real-provider contract test path exists | Done |

## Sprint 3 — Ingest validation foundation

| Item | Status | Notes |
|---|---|---|
| Shared normalized update contract added | Done | Added `functions/src/providers/providerTypes.ts`. |
| Shared ingest validation helper added | Done | Added `functions/src/ingest/validateMatchUpdate.ts`. |
| Team-ID validation runs before ingest writes | Done | `functions/src/ingest.ts` now validates before writing `matches`. |
| Rejected ingest updates quarantined to `providerErrors` | Done | Invalid updates are recorded with summary + reason. |
| Raw ingest summaries recorded under `providerRaw/{provider}/updates` | Done | Summary logging added before validation/write. |
| Manual admin upsert uses same team-ID validation path | Done | `functions/src/scoring.ts` manual upsert now validates team IDs and payload shape. |
| Replay provider / shadow ingest path available for operator testing | Done | Replay provider and `shadowMatches` controls are available from admin fixtures. |
| Explicit `settings/liveOps.mode` routes scheduled/manual ingest | Done | `disabled`, `shadow`, `staging`, and `production` now control target collection and recompute behavior. |
| Shadow mode writes leaderboard output to `shadowLeaderboard/current` | Done | Shadow/staging recompute now publishes sidecar leaderboard status without mutating public users/teams. |
| Admin can rerun shadow recompute and compare against public leaderboard | Done | Added callable + admin fixtures comparison panel for operator rehearsal. |
| Targeted emulator coverage exists for ingest/shadow/dirty flows | Done | Added regression scripts for quarantine, shadow routing, and retry recovery, and wired them into `test:rehearsal`. |
| Replay provider / shadow mode / provider contract tests | Pending | Manual/operator path exists; broader automated test coverage is still pending. |

## Sprint 5 — Mock users and destructive admin operations

| Item | Status | Notes |
|---|---|---|
| Mock users are marked with explicit metadata | Done | Batch seed now writes `isMock`, `mockBatchId`, `createdByAdminUid`, and `createdAt`. |
| Random per-batch password generated | Done | Mock seeding now returns a generated batch password instead of relying on a fixed default. |
| Exclude mock users from leaderboard option exists | Done | Stored under `settings/mockUsers.excludeMockUsersFromLeaderboard`; scoring skips mock rows when enabled. |
| Mock user cleanup by batch exists | Done | Added `adminDeleteMockUsersByBatch` callable and admin cleanup UI. |
| Orphan team deletion previews affected users | Done | Added server-side preview scan before deletion. |
| Orphan team deletion requires typed confirmation | Done | Requires `DELETE ORPHAN TEAMS` before deletion proceeds. |
| High-impact admin actions are auditable | Done | Added `adminEvents/{eventId}` logging for mock seeding, cleanup, and orphan deletion. |

## Sprint 7 — Real provider selection

| Item | Status | Notes |
|---|---|---|
| Provider scoring matrix created | Done | Added [`docs/current/PROVIDER-SELECTION-MATRIX.md`](/Users/harrison.j/world-cup-sweepstakes-clean/docs/current/PROVIDER-SELECTION-MATRIX.md). |
| Current adapter readiness documented | Done | Matrix records `football-data.org` plus the new Sportmonks trial adapter state. |
| Sportmonks trial adapter implemented | Done | `functions/src/ingest.ts` now supports Sportmonks season/fixture fetch through the normalized ingest path. |
| Real-provider contract test can run through shadow pipeline | Done | Added `adminContractTestProvider` callable and admin fixtures control for shadow contract runs. |
| Evidence-based practical frontrunner identified | Done | Current recommendation is football-data.org first under budget constraints, API-Football backup, Sportmonks retained only as a high-cost trial path. |
| Provider selected | Done | `football-data.org` is now the selected provider after local script proof plus live `/admin/fixtures` shadow rehearsal on 2026-05-15. |
| Token/secret storage confirmed for chosen provider | Done | `FOOTBALL_DATA_TOKEN` is now configured in local `functions/.secret.local` for provider proof runs. |
| Shadow test passed for chosen provider | Done | `football-data.org` shadow proof passed on 2026-05-15 with preview `24`, updated `24`, quarantined `0`, and no public collection pollution. |
| Normal local project shadow rehearsal passes | Done | `worldcup-sweepstake-2026` emulator rehearsal passed on 2026-05-15 with preview `24`, updated `24`, quarantined `0`; local emulator happened to be empty before the run, so browser/admin UI rehearsal is still a separate optional check. |
| Live browser/admin shadow rehearsal passes | Done | `/admin/fixtures` contract test on 2026-05-15 mapped `72`, updated `72`, quarantined `0`, and updated `shadowLeaderboard/current` correctly. |
| Local secret template exists for provider proof | Done | Added `functions/.secret.local.example` for emulator-side provider contract runs. |
| Contract-test observability matches health panels | Done | Verified in the admin UI on 2026-05-15: contract-test runs populate liveOps health plus ingest/recompute health timestamps. |

## Sprint 8 — Release hardening

| Item | Status | Notes |
|---|---|---|
| Report-only CSP added | Done | Added `Content-Security-Policy-Report-Only` in `next.config.ts`. |
| CSP documentation updated | Done | `docs/current/HTTP-HEADERS.md` now reflects report-only CSP status. |
| Final go / no-go checklist exists | Done | Added [`docs/current/PRODUCTION-GO-NO-GO-CHECKLIST.md`](/Users/harrison.j/world-cup-sweepstakes-clean/docs/current/PRODUCTION-GO-NO-GO-CHECKLIST.md). |
| Root `npm audit --omit=dev` rerun in this sprint | Done | Re-run on 2026-05-16 after dependency upgrades. |
| Functions `npm audit --omit=dev` rerun in this sprint | Done | Re-run on 2026-05-16 after dependency upgrades. |
| Next.js security patch upgrade applied | Done | Root app upgraded to `next@16.2.6`, the current published stable version on 2026-05-16. |
| Firebase client/admin package upgrades applied | Done | Root app upgraded to `firebase@12.13.0`; Functions upgraded to `firebase-admin@13.10.0` and `firebase-functions@7.2.5`. |
| Root app build passes after Sprint 8 upgrades | Done | `npm run build` passed on 2026-05-16. |
| Functions build passes after Sprint 8 upgrades | Done | `cd functions && npm run build` passed on 2026-05-16. |
| Functions dependency critical/high blockers removed | Done | Targeted overrides reduced Functions audit state to low-only on 2026-05-16. |
| No open Critical or High findings | Done | Verified by final audit JSON on 2026-05-16. |
| Medium findings fixed or explicitly accepted | Pending | Root app still has the moderate Next/PostCSS-linked finding `RH-001`. |
| Browser/emulator smoke suite runbook exists | Done | Added [`docs/current/BROWSER-EMULATOR-LAUNCH-SMOKE.md`](/Users/harrison.j/world-cup-sweepstakes-clean/docs/current/BROWSER-EMULATOR-LAUNCH-SMOKE.md). |
| Isolated emulator rehearsal command conflict documented | Done | `npm run test:rehearsal` currently conflicts with a live local emulator stack on default ports; documented in the smoke runbook. |
| Final launch rehearsal runbook exists | Done | Added [`docs/current/FINAL-LAUNCH-REHEARSAL.md`](/Users/harrison.j/world-cup-sweepstakes-clean/docs/current/FINAL-LAUNCH-REHEARSAL.md). |
| Isolated emulator rehearsal suite executed and recorded | Done | `npm run test:rehearsal` passed on 2026-05-18 after pausing the long-running emulator stack; results are captured in the smoke and final rehearsal docs. |
| Local visible fabricated-live simulator exists | Done | Added localhost-visible rehearsal controls that reset public game data while preserving users, then apply 2026-team match waves to public `matches` so dashboard and leaderboard movement can be observed. |
| Go / no-go sign-off completed | Pending | Requires final release candidate verification, production shadow pass, and security blocker resolution/acceptance. |
