# Scalability & Hardening Sprint — World Cup 2026

**Created:** 2026-05-27  
**Purpose:** Harden the app to safely handle 100–150 concurrent users during the live tournament.  
**Trigger:** Pre-launch audit conducted 2026-05-27 via Claude Code session.

---

## Hard Constraints

These constraints apply to every bundle in this sprint and cannot be waived:

1. **No functional changes.** Existing game behaviour — scoring, transfers, squad assignment, leaderboard — must work identically after every bundle. Bundles fix bugs and add safety; they do not change rules.
2. **No user data mutations** unless explicitly listed in the bundle (only Bundle 3 touches live data — it seeds the `usernames` collection from existing values).
3. **Existing users stay in the game.** All currently registered users (MrH / AS8FMz7jEGW8xuEZfmfshsRj8AC3, EdiHa / VE8dgD64TDbJL47iDz6haK1bbow2, Darren Martin / rZ5FBgkm2tRFtxAl4xq0JIe2wl32) must be completely unaffected.
4. **OK-gated execution.** No bundle is executed until the owner explicitly approves with "ok". Each bundle is summarised before execution and tested after.
5. **Clean commits.** Each bundle is one logical commit (or two if a deploy step is separate). No `Co-Authored-By` lines.

---

## Audit Summary — Issues Being Fixed

Full audit report produced by Claude Code on 2026-05-27. Issues by severity:

### 🔴 Critical
| ID | Issue | Bundle |
|----|-------|--------|
| C1 | Cloud Function memory/timeout not configured — `recomputeScores` will timeout at full load | 1 |
| C2 | `assignDrawnTeams` is a non-atomic read→write — concurrent calls can assign 10 drawn teams | 2 |
| C3 | `setUsername` is non-atomic — two users can simultaneously claim the same username | 3 |

### 🟡 Important
| ID | Issue | Bundle |
|----|-------|--------|
| I1 | No automated Firestore security rules tests — rule regressions are invisible | 4 |
| I2 | No load simulation — no proof the system holds under 150 concurrent users | 5 |
| I3 | No structured deploy + test gate before tournament | 6 |

### 🟢 Accepted / Mitigated (no action required)
| ID | Issue | Rationale |
|----|-------|-----------|
| A1 | `ensureUserProfile` non-atomic | Idempotent by design; last-write-wins is safe |
| A2 | Leaderboard single-doc write hotspot | At 150 users, write rate is within Firestore limits; risk only materialises above ~500 |
| A3 | No IP-level rate limiting | All users are known/trusted; business-logic guards protect data integrity |
| A4 | `confirmFeaturedTeam` concurrency | Already wrapped in a Firestore transaction (line 255 of onboarding.ts) |

---

## Bundle Specifications

### Bundle 1 — Function Runtime Configuration
**Status:** ☐ Pending

**Problem (C1):** All Cloud Functions run on Firebase defaults: 256 MB RAM, 60-second timeout. `recomputeScores` performs a full scan of all user docs + all matches + sort + batch writes. At 150 users this will approach or exceed 60 seconds, causing partial score updates.

**Fix:** Set explicit `memory` and `timeoutSeconds` per function in `firebase.json`. No TypeScript changes.

**Memory/timeout assignments:**
| Function group | Memory | Timeout |
|---------------|--------|---------|
| `recomputeScores`, `recomputeShadowScores`, `retryDirtyRecompute` | 512 MiB | 120 s |
| `ingestLiveScores` (scheduled) | 512 MiB | 120 s |
| `executeTransfer`, `confirmFeaturedTeam`, `assignDrawnTeams` | 256 MiB | 30 s |
| All other onCall functions | 256 MiB | 30 s |

**Files changed:**
- `firebase.json` — add `memory` and `timeoutSeconds` per function

**Deploy command:** `firebase deploy --only functions`

**Verification:** `firebase functions:list` — confirm memory/timeout values are live.

**Risk to existing users:** None. Config-only redeploy.

---

### Bundle 2 — Fix `assignDrawnTeams` Race Condition
**Status:** ✅ Complete

**Problem (C2):** `assignDrawnTeams` (onboarding.ts:146) reads the portfolio, checks `existingDrawn.length < 5`, draws 5 teams, then writes back. This read→check→write is not atomic. If two calls arrive within the same second (client double-tap, network retry, or admin tool), both pass the check independently and both write — leaving the user with 10 drawn teams.

**Fix:** Wrap the entire operation in a Firestore transaction. Inside the transaction:
1. Read user doc
2. Re-check drawn count (now under transaction lock)
3. If already ≥ 5 drawn teams → return idempotent success, no write
4. Otherwise draw and write within the transaction

**Files changed:**
- `functions/src/onboarding.ts` — `assignDrawnTeams` function only

**Deploy command:** `firebase deploy --only functions`

**Verification:** Run `npm run test:rehearsal`. All 7 existing tests must pass.

**Risk to existing users:** None. The transaction only changes behaviour in the silent race case that currently corrupts data. Normal single-call behaviour is identical.

---

### Bundle 3 — Fix `setUsername` Race Condition
**Status:** ✅ Complete

**Problem (C3):** `setUsername` (onboarding.ts:321) queries `users` collection for duplicate usernames, then writes if none found. This query→write is non-atomic. Two users simultaneously picking "Player1" can both pass the uniqueness check and both succeed.

**Fix:** Add a `usernames/{username}` Firestore collection as an atomic uniqueness lock. The document ID is the username itself. `setUsername` becomes a Firestore transaction that:
1. Reads `usernames/{newUsername}` — if it exists and belongs to a different uid, throw "username taken"
2. Creates `usernames/{newUsername}` with `{ uid }` inside the transaction
3. Deletes `usernames/{oldUsername}` (if the user is changing their username)
4. Updates `users/{uid}.username` within the same transaction
All four operations are atomic — if any step fails (e.g. username already claimed by another user between the read and write), the entire transaction rolls back.

**Sub-steps:**
- (a) Update `setUsername` in `functions/src/onboarding.ts`
- (b) Add `usernames` collection rules to `firestore.rules`
- (c) One-time migration script to seed existing 3 users' usernames into the new collection before deploy
- (d) Deploy functions + rules

**Migration (step c) — seeds these exact documents, no other data touched:**
```
usernames/MrH        → { uid: "AS8FMz7jEGW8xuEZfmfshsRj8AC3" }
usernames/EdiHa      → { uid: "VE8dgD64TDbJL47iDz6haK1bbow2" }
usernames/Darren Martin → { uid: "rZ5FBgkm2tRFtxAl4xq0JIe2wl32" }
```

**Firestore rules addition:**
```
match /usernames/{username} {
  // Anyone signed in can read (for future client-side availability checks)
  allow read: if signedIn();
  // Only the claiming user can create/delete their own username lock
  allow create: if signedIn()
    && request.resource.data.keys().hasOnly(["uid"])
    && request.resource.data.uid == request.auth.uid;
  allow delete: if signedIn()
    && resource.data.uid == request.auth.uid;
  // No direct updates — must delete + create via the Cloud Function transaction
  allow update: if false;
}
```

**Files changed:**
- `functions/src/onboarding.ts`
- `firestore.rules`
- `scripts/migrate-usernames.ts` (new, run once, then archivable)

**Deploy command:** Migration script first, then `firebase deploy --only functions,firestore:rules`

**Verification:** `npm run test:rehearsal` — all 7 pass.

**Risk to existing users:** None. Migration runs before deploy. Existing usernames are preserved exactly.

---

### Bundle 4 — Firestore Security Rules Unit Test Suite
**Status:** ☐ Pending

**Problem (I1):** `firestore.rules` is hand-verified only. Any future edit to the rules file has no regression harness — a typo or logic error silently exposes or locks out data.

**Fix:** Add `@firebase/rules-unit-testing` as a dev dependency and write a comprehensive test suite.

**Test cases (all run against emulator):**

*User collection (`/users/{uid}`)* 
- ✓ Authenticated user can read their own doc  
- ✓ Authenticated user cannot read another user's doc  
- ✓ Authenticated user can create their own doc with valid fields  
- ✓ Create is rejected if `totalScore != 0`  
- ✓ Create is rejected if `remainingTransfers != 2`  
- ✓ Create is rejected if `isAdmin == true`  
- ✓ Create is rejected if portfolio is non-empty  
- ✓ Create is rejected if unknown fields are present  
- ✓ User can update allowed fields (displayName, email, photoURL, hasSeenReveal, updatedAt)  
- ✓ Update is rejected if portfolio is changed directly  
- ✓ Update is rejected if totalScore is changed  
- ✓ Update is rejected if remainingTransfers is changed  
- ✓ Unauthenticated read is rejected  

*Usernames collection (`/usernames/{username}`)*
- ✓ Authenticated user can claim a username (create with own uid)
- ✓ Create is rejected if uid does not match request.auth.uid
- ✓ User can delete their own username lock
- ✓ User cannot delete another user's username lock
- ✓ Direct update is rejected

*Admin-only collections (matches, leaderboard, teams, settings)*
- ✓ Authenticated non-admin cannot write to matches
- ✓ Authenticated non-admin cannot write to leaderboard
- ✓ Authenticated user can read matches (signed-in read is allowed)
- ✓ Admin token can write to matches

*Catch-all*
- ✓ Any other path is denied for read and write

**Files changed:**
- `functions/src/tests/rules.test.ts` (new)
- `functions/package.json` — add `@firebase/rules-unit-testing` dev dependency, add `test:rules` script

**Deploy command:** None. Test-only.

**Verification:** `npm run test:rules` — all cases pass.

---

### Bundle 5 — Concurrent Load Simulation
**Status:** ☐ Pending

**Problem (I2):** There is no test that proves the system holds under realistic concurrent load. All current tests are sequential. The first time 150 users interact simultaneously could be the live tournament.

**Fix:** Write `scripts/test-load-sim.ts` — a controlled concurrency test against the **local emulator only**. It never touches production.

**Simulation steps:**
1. Confirm emulator is running; abort if not
2. Seed 30 mock users via Admin SDK (synthetic UIDs, seeded directly — no Auth needed)
3. Seed a mock user doc for each in Firestore (valid portfolio-less doc)
4. Fire `confirmFeaturedTeam` for all 30 simultaneously — `Promise.allSettled`
5. Assert: all 30 resolved successfully, each has exactly 1 featured + 5 drawn teams, all drawn teams are from unique groups
6. Fire `executeTransfer` for 10 of the 30 simultaneously — `Promise.allSettled`
7. Assert: all 10 resolved, `remainingTransfers` decremented correctly, no user ended up with the wrong team count
8. Read the leaderboard snapshot and assert all 30 users appear with consistent ranks
9. Delete all 30 mock users (Firestore docs only — no Auth users were created)
10. Print a pass/fail summary with timing

**Files changed:**
- `scripts/test-load-sim.ts` (new)
- `package.json` — add `test:load-sim` script

**Deploy command:** None. Emulator only.

**Verification:** `npm run test:load-sim` — all assertions pass, all mock users cleaned up.

---

### Bundle 6 — Full Deploy & Test Gate
**Status:** ☐ Pending

**Purpose (I3):** A single verified deploy of all changes accumulated in Bundles 1–5, with a full end-to-end test run as the acceptance gate. This is the bundle that takes the hardened build to production.

**Pre-conditions:** Bundles 1–5 all complete and individually verified.

**Steps:**
1. Confirm clean `git status` — all bundle commits are in
2. `firebase deploy --only functions,firestore:rules` — single atomic deploy
3. Run full test suite:
```bash
npm run test:rehearsal          # 7 existing emulator integration tests
npm run test:rules              # new rules unit tests (Bundle 4)
npm run test:load-sim           # new load simulation (Bundle 5)
npm run test:in-app-browser     # UA detection
```
4. `firebase functions:list` — confirm memory/timeout config is live in production
5. Manual smoke: sign in as MrH, confirm squad and score are intact

**Pass criteria:** All test scripts exit 0. Firebase Console shows correct function config. MrH account is unchanged.

**Files changed:** None. Deploy + verification only.

---

## Bundle Execution Log

| Bundle | Status | Commit | Notes |
|--------|--------|--------|-------|
| 1 — Function config | ✅ | `bundle-1-function-config` | All 29 functions; heavy 512MiB/120s, standard 256MiB/30s |
| 2 — assignDrawnTeams tx | ✅ | `bundle-2-assignDrawnTeams-race-fix` | Firestore transaction; stale test penalty updated 10→3 |
| 3 — setUsername tx + migration | ✅ | `bundle-3-setUsername-race-fix` | usernames/{lower} lock; 3 users migrated pre-deploy |
| 4 — Rules test suite | ☐ | — | |
| 5 — Load simulation | ☐ | — | |
| 6 — Deploy + test gate | ☐ | — | |

---

## Key Files Reference

| File | Role |
|------|------|
| `functions/src/onboarding.ts` | Bundles 2 + 3 — race condition fixes |
| `firestore.rules` | Bundle 3 — usernames collection rules |
| `firebase.json` | Bundle 1 — function memory/timeout config |
| `scripts/migrate-usernames.ts` | Bundle 3 — one-time username migration |
| `functions/src/tests/rules.test.ts` | Bundle 4 — rules unit tests |
| `scripts/test-load-sim.ts` | Bundle 5 — concurrency simulation |

---

## Test Commands Reference

```bash
# Existing suite (7 integration tests, requires emulators running)
npm run test:rehearsal

# New: Firestore rules unit tests (Bundle 4)
npm run test:rules

# New: Load simulation against emulator (Bundle 5)
npm run test:load-sim

# Existing: UA detection (16 cases, no emulator)
npm run test:in-app-browser

# Existing: Badge feasibility audit
npm run test:badge-feasibility
```

---

## Deployment Commands Reference

```bash
# Functions only (Bundles 1, 2)
firebase deploy --only functions

# Functions + Firestore rules (Bundle 3, Bundle 6)
firebase deploy --only functions,firestore:rules

# Verify deployed function config
firebase functions:list
```

---

*This document is the authoritative source of truth for this sprint. Update the execution log table as each bundle completes.*
