# Tournament Runbook (Cost-Safe)

This runbook is for admin operation of live score updates and leaderboard refresh during World Cup 2026.

## 1) Environments and Cost Guardrail

- Admin control page: `/admin/fixtures`
- Automation section: `Live Automation (Scheduler)`
- Default safe state:
  - `DISABLED`
  - Provider: `Fixture (safe testing)`

When automation is `DISABLED`, scheduled ingestion does not run. This is the recommended default outside tournament live windows.

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

## 3) Go-Live Switch (Tournament)

Use this only when real provider integration is ready and tested.

1. In `/admin/fixtures` > `Live Automation (Scheduler)`:
   - Set provider to `Provider (production)`.
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
  - Provider `Provider (production)`
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
- [ ] Provider mode cannot be enabled without `FOOTBALL_DATA_TOKEN`.
- [ ] `Ingest Health` panel in `/admin/fixtures` shows:
  - `Last success`
  - `Last error`
  - `Error message`
- [ ] Fallback path validated: `Run Fixture Ingest` + `Recompute Leaderboard`.

### Transfer Reliability

- [ ] `executeTransfer` callable is deployed.
- [ ] Transfer window enforcement works (`settings/transferWindow` open/close).
- [ ] One valid transfer succeeds and decrements `remainingTransfers`.
- [ ] Invalid repeat transfer is blocked with `failed-precondition`.
- [ ] Penalty scoring is applied via recompute and reflected in user score.
- [ ] Transfer window returned to `enabled: false` after testing.

### UX and Ops Consistency

- [ ] Dashboard and Badges share same nav labels/order:
  - `Sign in/Sign out`, `My Teams`, `Transfer`, `Leaderboard`, `Live`, `Badges`
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
