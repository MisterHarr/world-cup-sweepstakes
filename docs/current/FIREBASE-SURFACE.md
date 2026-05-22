# Firebase surface (backend + client contract)

**Last updated:** 2026-03-27  
**Purpose:** Pre-audit map of rules, regions, and callable entry points.

## Project layout (repo)

| Asset | Path |
|-------|------|
| Firebase config | `firebase.json` |
| Firestore rules | `firestore.rules` |
| Firestore indexes | `firestore.indexes.json` |
| Cloud Functions source | `functions/` |
| Client Firebase init | `lib/firebase.ts` |

**Firestore location:** `asia-southeast1` (see `firebase.json`).  
**Callable / HTTPS functions region:** `asia-southeast1` (must match `getFunctions(app, "asia-southeast1")` in `lib/firebase.ts`).

There is **no** `storage.rules` in this repo; Storage may be unused or configured elsewhere.

## Auth helpers (`functions/src/auth.ts`)

| Helper | Behavior |
|--------|----------|
| `requireAuth(request)` | Throws if `request.auth` / UID missing |
| `requireAdmin(request)` | `requireAuth` + custom claim `token.admin === true` |

Some functions use **inline** `request.auth` checks instead of these helpers; behavior is noted below.

## Callable functions (`onCall`)

| Export | Module | Auth expectation |
|--------|--------|------------------|
| `ensureUserProfile` | `index.ts` | Signed-in Firebase user |
| `assignDrawnTeams` | `index.ts` | Signed-in |
| `confirmFeaturedTeam` | `index.ts` | Signed-in |
| `setDepartment` | `index.ts` | Signed-in; department change restricted after set unless admin claim |
| `getLeaderboard` | `getLeaderboard.ts` | Signed-in (`request.auth` checked) |
| `getSquadDetails` | `getSquadDetails.ts` | Signed-in; reads other users’ squads per server rules |
| `getTransferHistory` | `getTransferHistory.ts` | `requireAuth` |
| `executeTransfer` | `transfers.ts` | `requireAuth` |
| `setAdminClaim` | `admin.ts` | `requireAdmin` |
| `adminUpsertMatch` | `scoring.ts` | `requireAdmin` |
| `recomputeScores` | `scoring.ts` | `requireAdmin` |
| `adminListUsers` | `index.ts` | `request.auth.token.admin === true` |
| `adminAssignTeamsToUser` | `index.ts` | Admin token |
| `adminSeedMockUsers` | `index.ts` | Admin token |
| `adminIngestFixture` | `ingest.ts` | `requireAdmin` |
| `adminResetFixtureIngest` | `ingest.ts` | `requireAdmin` |
| `adminIngestPreTournament` | `ingest.ts` | `requireAdmin` |
| `setLiveOpsSettings` | `ingest.ts` | `requireAdmin` |

## Scheduled / background

| Export | Type | Notes |
|--------|------|--------|
| `ingestLiveScores` | `onSchedule` | Not client-invoked; runs in backend |

## Firestore rules

Authoritative logic lives in **`firestore.rules`** at the repo root (`rules_version = '2'`).  
Review **admin** vs **signed-in** vs **user document** access there before any security audit.

## Client usage

HTTPS callable names must match the **exported** function names above. The app uses `httpsCallable(functions, "…")` from `firebase/functions` — see usages under `app/` and `lib/`.

## OAuth & redirects

Google sign-in, authorized domains, and OAuth client origins/redirect URIs (web + future mobile) are documented in **`OAUTH-REDIRECTS.md`**.
