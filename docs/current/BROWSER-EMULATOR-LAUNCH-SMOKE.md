# Browser / Emulator Launch Smoke

Last updated: 2026-05-22

Use this as the concrete execution sheet for the documented `Browser/emulator test suite` step.

This sheet is for the safe emulator lane. It does not prove real Google sign-in or real password-reset email delivery. For that, use `npm run dev:live-auth` and the real-auth rehearsal notes in `ENV-VARS.md` / `OAUTH-REDIRECTS.md`.

## Goal

Prove that the release candidate can:

- serve the main app on the expected local port
- complete the core signed-in user path
- block non-admin access to admin routes
- allow admin operational access
- preserve privacy on leaderboard/squad views
- support the manual fallback and transfer-critical paths

## Pre-flight

1. Start the local app on port `3001`:
   - `npm run dev:emulator`
2. Start the persisted Firebase emulator stack:
   - `npm run emulators:start`
3. Confirm the app responds:
   - `curl -I http://localhost:3001`
4. Have two emulator accounts ready:
   - one non-admin
   - one admin
5. Seed teams if the local emulator is empty:
   - `/admin/seed-teams` -> `Seed Teams`

## Browser smoke checks

### Core signed-in path

- [ ] `/` loads successfully
- [ ] Email sign-in / sign-up works locally without popup loop
- [ ] First sign-in advances directly to `/featured-team`
- [ ] Team list is visible on `/featured-team`
- [ ] Featured selection advances to `/reveal`
- [ ] `/dashboard` loads after reveal
- [ ] `/department` redirects to `/featured-team` and does not show department choices
- [ ] `/badges` redirects to `/dashboard` and does not show badge catalog UI

### Privacy / public surface

- [ ] `/leaderboard` loads
- [ ] Opening another user’s squad does not expose raw email as display text
- [ ] Public squad view still shows a safe player label fallback

### Admin access control

- [ ] Non-admin is blocked from `/admin`
- [ ] Non-admin is blocked from `/admin/fixtures`
- [ ] Admin can open `/admin/fixtures`
- [ ] Admin page shows environment badge and project id
- [ ] Admin page shows localhost-production confirmation guard

### Operator workflow basics

- [ ] `football-data.org` remains selectable in `/admin/fixtures`
- [ ] Shadow contract test controls render
- [ ] Health panels render without permission errors
- [ ] Manual recompute controls render

### Transfer / fallback basics

- [ ] Admin can open transfer window from `/admin/fixtures`
- [ ] Transfer window state affects `/dashboard?tab=market`
- [ ] Manual fallback path is visible:
  - `Run Fixture Ingest`
  - `Recompute Leaderboard`

## Emulator regression suite

Primary scripted suite:

- `npm run test:rehearsal`

Current operational note:

- If your long-running local emulator stack is already using ports `9099`, `8080`, and `5001`, this command will fail to start its own demo-project emulators.
- In that case, either:
  1. stop the long-running local emulator stack first, then run `npm run test:rehearsal`, or
  2. keep the long-running stack up and treat this scripted pass as a separate isolated step.

## Current status from this pass

- [x] App restarted on `http://localhost:3001`
- [x] Host-side reachability verified with `curl -I http://localhost:3001`
- [ ] Browser smoke fully completed
- [x] `npm run test:rehearsal` completed in isolated mode

## Result notes

Use this block during sign-off:

- Date: 2026-05-18
- Tester: Codex scripted rehearsal
- App build version / branch: local working tree on `http://localhost:3001`
- Non-admin route result: Pending explicit browser/operator recording
- Admin route result: Pending explicit browser/operator recording
- Leaderboard privacy result: Pending explicit browser/operator recording
- Transfer/fallback result: Pending explicit browser/operator recording
- Scripted emulator suite result: Passed in isolated mode via `npm run test:rehearsal` after temporarily stopping the long-running local emulator stack. Transfer regression, closed-window guardrail, squad privacy/public visibility, ingest quarantine, shadow routing, and dirty retry recovery all passed.
- Follow-up issues: Browser/operator checklist still needs clean human sign-off. The long-running local emulator stack must be paused before running the isolated rehearsal suite on default emulator ports.
