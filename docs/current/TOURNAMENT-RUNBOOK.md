# Tournament Runbook (Cost-Safe)

This runbook is for admin operation of live score updates and leaderboard refresh during World Cup 2026.

## 1) Environments and Cost Guardrail

- Admin control page: `/admin/fixtures`
- Automation section: `Live Automation (Scheduler)`
- Default safe state:
  - `DISABLED`
  - Provider: `Fixture (safe testing)`

When automation is `DISABLED`, scheduled ingestion does not run. This is the recommended default outside tournament live windows.

## 1.1) Roster vs fixture JSON (after a `TEAMS_SEED` change)

Bundled rehearsal files **`functions/src/fixtures/worldcup2022.json`** and **`pretournament2022.json`** reference **2022** participants. The live **`teams`** collection is seeded from **`lib/seed/teamsSeed.ts` (2026)**. Any `homeTeamId` / `awayTeamId` in fixtures **without** a matching `teams/{id}` document can produce **zero points** or odd leaderboard behaviour for that match.

**Operator checklist after roster / seed changes:**

1. **`/admin/seed-teams`** → **Seed Teams**, then **Remove orphan team docs** if ids were retired.
2. From repo root: **`npm run audit:fixture-teams`** — lists fixture ids not in the current 2026 seed (expected to be many for 2022 JSON). Use **`--strict`** only when you have aligned fixture files and want CI to fail on drift.
3. Before a **2022 replay** rehearsal: either accept partial coverage, **trim** fixture JSON to 2026 nations only, or maintain **extra** `teams` docs for rehearsal-only ids (not recommended for production).

## 2) Before Tournament Start

1. Sign in as admin and open `/admin/fixtures`.
2. Confirm:
   - `Signed in: Yes`
   - `Admin: Yes`
3. Confirm automation is `DISABLED`.
4. Run deterministic test data check:
   - Set `Max matches = 12`
   - Click `Preview Reset`
   - Tick confirmation checkbox
   - Click `Reset + Ingest`
5. Verify status:
   - `✅ Reset deleted ... ingested 12, updated ...`
   - `✅ Recomputed for ... users (... matches).`
6. Verify UI:
   - `/dashboard?tab=leaderboard`
   - `/dashboard?tab=bracket` → `Results`

## 2.1) Staged 2022 Replay (Recommended for Load Rehearsals)

Use staged ingest to simulate tournament progression instead of dumping all fixture data at once.

Important current dataset note:
- `functions/src/fixtures/worldcup2022.json` currently contains **12 group-stage matches** (opening slice), not full knockout coverage.
- This section replays that group slice in **3 waves**.
- Those matches still reference **2022** `teamId`s; cross-check against your Firestore **`teams`** set (see **§1.1**).

One-time setup:
1. Open `/admin/users` as admin.
2. In `Mock User Batch Seeding`, run:
   - `Count`: `24` to `60`
   - `Departments`: `Round Robin`
   - Click `Seed Mock Users`
   - Seeded login password: `Test1234!`
3. Open `/admin/fixtures`.
4. Click `Preview Reset`, then `Reset + Ingest` with:
   - `maxMatches`: blank
   - `cutoffIso`: `2022-11-21T23:59:59Z`

Wave schedule (cumulative cutoffs):

| Wave | Purpose | cutoffIso | Expected selected matches |
|---|---|---|---|
| G1 | Group opener block | `2022-11-21T23:59:59Z` | 4 |
| G2 | Group mid block | `2022-11-22T23:59:59Z` | 8 |
| G3 | Group close block | `2022-11-23T23:59:59Z` | 12 |

For each wave:
1. Set `cutoffIso` to the wave value above.
2. Leave `maxMatches` blank.
3. Click `Preview Selection` and verify count.
4. Click `Run Fixture Ingest`.
5. Click `Recompute Leaderboard` (explicit safety pass for rehearsal consistency).
6. Validate:
   - `/dashboard?tab=portfolio` score parity
   - `/dashboard?tab=leaderboard` rank movement
   - `/dashboard?tab=market` transfer execution (if window open)

If/when full 2022 fixtures are added:
- Continue the same staged method with additional knockout cutoffs (R16, QF, SF, Final) rather than one-shot ingest.

## 2.2) Local Visible Fabricated-Live Rehearsal

Use this when you want the normal app UI to visibly change before the real tournament starts.

Purpose:

- Preserve local users and their team selections.
- Clear public game state back to zero.
- Apply fabricated 2026-team match waves to public `matches`.
- Verify dashboard, leaderboard, ingest health, and recompute health all move together.

Steps:

1. Open `/admin/fixtures`.
2. Confirm the localhost-production warning if required.
3. In `Local Visible Rehearsal`, click `Preview Reset`.
4. Click `Reset Visible Data`.
5. Verify users still exist and can sign in.
6. Click `Run Next Live Wave`.
7. Open `/dashboard` and `/leaderboard` in another tab.
8. Repeat `Run Next Live Wave` through the live and final waves.
9. Confirm:
   - match status moves from scheduled to live/finished
   - public leaderboard updates
   - user/team scores change from zero
   - `Ingest / Recompute Health` shows fresh success timestamps

This rehearsal is local/public by design. It is not a shadow test. Use it in the emulator or another non-production target where visible score changes are expected.

## 3) Go-Live Switch (Tournament)

Use this only when real provider integration is ready and tested.

1. In `/admin/fixtures` > `Live Automation (Scheduler)`:
   - Set provider to `football-data.org (smoke)` for the practical current path.
   - Use `Sportmonks (trial primary)` only as an optional high-cost trial path.
   - Enable `Enable scheduled ingest`.
2. Click `Save Automation Settings`.
3. Confirm message:
   - `✅ Automation enabled (provider).`
4. Confirm `Last update: ... • by ...`.
5. Monitor first 1-2 scheduler cycles on dashboard pages.

If provider integration is not ready, keep automation disabled and use manual admin actions.

## 4) During Tournament (Operational Loop)

- Primary mode: scheduled automation enabled (production provider).
- Backup mode (if issues): disable automation and run manual updates.

Manual fallback:
1. `/admin/fixtures`
2. `Run Fixture Ingest` (or provider-specific admin ingest when available)
3. `Recompute Leaderboard`
4. Validate Board + Live pages

## 5) Post-Tournament Shutdown

1. Set automation to `DISABLED`.
2. Click `Save Automation Settings`.
3. Confirm:
   - `✅ Automation disabled (...)`
4. Record final leaderboard timestamp from `Leaderboard Status`.

## 5.1) Transfer Window Control (Admin UI)

Use `/admin/fixtures` -> `Transfer Window`.

Open for dev testing:
1. Tick `Enable transfer window`.
2. Leave `Starts at` / `Ends at` blank for immediate open-ended testing, or set optional bounds.
3. Click `Save Transfer Window`.
4. Verify dashboard shows `Transfer Window Active`.

Close after testing:
1. Click `Close Window Now` (or untick `Enable transfer window` and save).
2. Verify dashboard shows `Transfer Window Closed`.

## 6) Incident Playbook

If scores/leaderboard stop updating:

1. Check `/admin/fixtures`:
   - automation state
   - provider selection
   - last update/by fields
2. Run `Recompute Leaderboard`.
3. Validate:
   - `Leaderboard Status` timestamp changes
4. If still broken, disable automation to stop noisy retries, then use manual fallback while investigating provider/function logs.

## 7) Safe Defaults Summary

- Non-tournament periods:
  - Automation `DISABLED`
  - Provider `Fixture (safe testing)` or `Stub (no ingest)`
- Tournament production:
  - Automation `ENABLED`
  - Provider `football-data.org (smoke)` unless a different real provider has passed shadow proof and been deliberately selected
- After tournament:
  - Automation `DISABLED`

## 8) Production Readiness Checklist (Pre-Go-Live)

Use this as the final sign-off before enabling production automation.

### Security and Access

- [ ] Admin account shows `Admin: Yes` in `/admin/fixtures`.
- [ ] Firestore rules are deployed with:
  - admin-only writes for `/settings`, `/matches`, `/teams`, `/leaderboard`
  - user self-only reads/limited profile updates for `/users/{uid}`
- [ ] Admin claim refresh verified in browser (`getIdTokenResult(true)` shows `admin: true`).

### Live Ingest Guardrails

- [ ] `Live Automation (Scheduler)` default is `DISABLED` outside live windows.
- [ ] `football-data.org` mode cannot be enabled without `FOOTBALL_DATA_TOKEN`.
- [ ] `Sportmonks` mode cannot be enabled without `SPORTMONKS_TOKEN`.

## Sportmonks contract-test steps

Use this before declaring Sportmonks the selected provider.

1. Create `functions/.secret.local` from [`functions/.secret.local.example`](/Users/harrison.j/world-cup-sweepstakes-clean/functions/.secret.local.example).
2. Set:
   - `SPORTMONKS_TOKEN`
   - `SPORTMONKS_SEASON_ID`
3. Start the emulators and open `/admin/fixtures`.
4. In Live Automation:
   - set provider to `Sportmonks (trial primary)`
   - keep mode on `shadow` or `staging`
5. In `Real Provider Contract Test`:
   - run preview first
   - run shadow contract test
6. Verify:
   - mapped match count is non-zero
   - quarantine count is acceptable and explainable
   - `shadowMatches` updates
   - `shadowLeaderboard/current` updates
   - no public `matches` or `leaderboard/current` pollution
7. Record findings in [`docs/current/PROVIDER-SELECTION-MATRIX.md`](/Users/harrison.j/world-cup-sweepstakes-clean/docs/current/PROVIDER-SELECTION-MATRIX.md).
- [ ] `football-data.org` practical proof has been run and recorded before any launch-provider decision.
- [ ] `Sportmonks` is treated as optional trial-only unless budget approval changes.
- [ ] `Ingest Health` panel in `/admin/fixtures` shows:
  - `Last success`
  - `Last error`
  - `Error message`
- [ ] Fallback path validated: `Run Fixture Ingest` + `Recompute Leaderboard`.

## football-data.org contract-test steps

Use this before declaring `football-data.org` the selected provider.

1. Start local services with persistence:
   - `npm run emulators:start`
   - `npm run dev`
2. Create `functions/.secret.local` from [`functions/.secret.local.example`](/Users/harrison.j/world-cup-sweepstakes-clean/functions/.secret.local.example).
2. Set:
   - `FOOTBALL_DATA_TOKEN`
3. Open `/admin/fixtures`.
4. In Live Automation:
   - set provider to `football-data.org (smoke)`
   - keep mode on `shadow` or `staging`
5. In `Real Provider Contract Test`:
   - run preview first
   - run shadow contract test
6. Verify:
   - mapped match count is non-zero
   - quarantine count is acceptable and explainable
   - `shadowMatches` updates
   - `shadowLeaderboard/current` updates
   - no public `matches` or `leaderboard/current` pollution
7. Record findings in [`docs/current/PROVIDER-SELECTION-MATRIX.md`](/Users/harrison.j/world-cup-sweepstakes-clean/docs/current/PROVIDER-SELECTION-MATRIX.md).

## Local admin persistence note

- Use `npm run emulators:start` for day-to-day local work.
- That command imports and exports emulator state from `.local/firebase-emulators/`, so local email/password accounts, admin claims, and Firestore docs survive normal restarts.
- If you start emulators some other way without the import/export flags, local auth users and claims can disappear on restart.
- After this persistence setup was added on 2026-05-15, one final re-creation of your local admin account/claim may still be needed because earlier emulator restarts were ephemeral.
- If the local Auth Emulator has no accounts, create or repair a local admin in one step:

```bash
cd functions
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run create-local-admin -- you@example.com "Test1234!" "Your Name"
```

- Local Google sign-in is not a reliable emulator login path. Use local email/password for emulator testing; use Google sign-in in the real Firebase Auth environment.

### Transfer Reliability

- [ ] `executeTransfer` callable is deployed.
- [ ] Transfer window enforcement works (`settings/transferWindow` open/close).
- [ ] One valid transfer succeeds and decrements `remainingTransfers`.
- [ ] Invalid repeat transfer is blocked with `failed-precondition`.
- [ ] Penalty scoring is applied via recompute and reflected in user score.
- [ ] Transfer window returned to `enabled: false` after testing.

### UX and Ops Consistency

- [ ] Launch nav uses the simplified game scope:
  - `Sign in/Sign out`, `My Teams`, `Leaderboard`, `Live`, `Transfer`, plus optional `Guide` / `Charity`
- [ ] Department and Badges are not visible in user-facing launch nav or onboarding.
- [ ] No duplicate auth buttons or nav overlap in desktop layout.
- [ ] Mobile nav menu shows same items/order as desktop.

### Low-Cost Operating Rule

- [ ] Keep scheduler `DISABLED` except explicit match windows.
- [ ] If provider is enabled, monitor first 1-2 cycles, then disable when not needed.
- [ ] During incidents, disable scheduler first, then use manual fallback.

## 9) Quick Verification Commands (Operator)

Run from project root:

```bash
firebase functions:log --only ingestLiveScores --project worldcup-sweepstake-2026 --lines 10
```

What to look for:

- Disabled mode: `liveOps disabled. Skipping scheduled ingest.`
- Enabled mode: provider load/update logs with no repeated errors.

If errors repeat, switch to manual mode immediately:

1. `/admin/fixtures`
2. Set automation to `DISABLED`
3. `Save Automation Settings`
4. Use `Run Fixture Ingest` + `Recompute Leaderboard`

## 10) External Alerting Setup (Cloud Monitoring)

Use this once per project to create ingest-failure alerting.

Prerequisites:

- Google Cloud project: `worldcup-sweepstake-2026`
- IAM access to create monitoring notification channels and alert policies.
- Either:
  - `gcloud` CLI installed and authenticated, or
  - Google Cloud Console web UI access.

Create or update alerting:

1. CLI path (preferred for repeatability), from repo root:

```bash
bash ops/monitoring/setup-ingest-alerting.sh worldcup-sweepstake-2026 <ops-email@company.com>
```

2. The script prints:
   - `NOTIFICATION_CHANNEL=projects/.../notificationChannels/...`
   - `ALERT_POLICY=projects/.../alertPolicies/...`
3. If prompted, verify the email channel in Google Cloud.
4. Web UI path (if `gcloud` is unavailable): Monitoring > Alerting > Create policy > Create log-based alert policy.

Alert test procedure:

1. Emit a synthetic error log:

```bash
gcloud logging write ingestLiveScores-test "[ingest] scheduled ingest failed: synthetic test" --severity=ERROR --project worldcup-sweepstake-2026
```

2. Wait 1-5 minutes.
3. Confirm an incident opens for `World Cup ingestLiveScores failures` and an email notification is received.
4. Acknowledge and close the test incident.

Record IDs (keep current):

- Notification channel ID: `projects/worldcup-sweepstake-2026/notificationChannels/5604417890488344253`
- Alert policy ID: `projects/worldcup-sweepstake-2026/alertPolicies/8460958675161850743`
- Monitoring incident URL: `https://console.cloud.google.com/monitoring/alerting/incidents?project=worldcup-sweepstake-2026`
- Last validated at: `2026-02-13T08:51:32Z` (synthetic test incident opened)
- Validated by: `jason.harrison855@gmail.com`
