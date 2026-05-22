# Agent handover — GIS 2026 World Cup Sweepstakes

**Audience:** A new coding agent taking over this repository.  
**Last updated:** 2026-05-22  
**Companion docs:** Git/PR rules and workflows live in [`NEW-CONTEXT-HANDOVER.md`](./NEW-CONTEXT-HANDOVER.md). Product/build history in [`BUILD-STATUS-NEXT-STEPS.md`](./BUILD-STATUS-NEXT-STEPS.md).

---

## 1. What this project is

Internal sweepstakes app: Firebase Auth + Firestore + **v2 callable Cloud Functions** (`asia-southeast1`), Next.js App Router front end. Initial launch scope is simplified: users sign in, pick a featured team, get a drawn squad, score against fixtures, view leaderboard/game surfaces, and use transfers when the window is open. Department and badge code remains in the repo, but the user-facing department and badge surfaces are hidden/redirected for launch.

**Default Firebase project (CLI):** `worldcup-sweepstake-2026` (see `.firebaserc`).

---

## 2. What is done (recent + stable)

### 2.1 World Cup 2026 roster sprint (2026-05-02)

Documented in [`TEAMS-ROSTER-UPDATE-SPRINT.md`](./TEAMS-ROSTER-UPDATE-SPRINT.md) and [`WORLD-CUP-2026-ROSTER.md`](./WORLD-CUP-2026-ROSTER.md).

- **`lib/seed/teamsSeed.ts`:** Full **48-team** 2026 roster; former **`PO_*`** placeholders replaced with real nation ids (`CZE`, `BIH`, `TUR`, `SWE`, `IRQ`, `COD`, etc.).
- **Validation:** `scripts/validate-teams-seed.ts` → **`npm run validate:teams-seed`** (structure: 48 teams, groups A–L, uniqueness).
- **Fixture id audit:** `scripts/audit-fixture-team-ids.ts` → **`npm run audit:fixture-teams`** (flags team ids in fixtures not in seed — expected where **2022** JSON still referenced).
- **`/admin/seed-teams`:** Merge seed + **Remove orphan team docs** (deletes `teams/{id}` not in current seed). Ops copy in [`ADMIN-TOOLS.md`](./ADMIN-TOOLS.md).
- **Runbook:** [`TOURNAMENT-RUNBOOK.md`](./TOURNAMENT-RUNBOOK.md) § roster vs fixtures; user-doc migration notes for anyone who ever held **`PO_*`** in `portfolio` / `entry`.
- **Emulator UX:** `firebase.json` sets **`emulators.ui.enabled: false`** so emulators start when port **4000** is busy.

### 2.2 Cloud Functions (repo state)

- **`assignDrawnTeams`:** If fewer than five drawable teams, the function throws **`failed-precondition`** with a message pointing at **`/admin/seed-teams`** (clearer than a generic `internal`). **Production only reflects this after deploy:** `firebase deploy --only functions` (or your CI equivalent).

### 2.3 Application (high level)

Per [`BUILD-STATUS-NEXT-STEPS.md`](./BUILD-STATUS-NEXT-STEPS.md): auth (Google + email/password paths in product history), featured team + draw, dashboard (portfolio / leaderboard / match center / transfer market), standalone **`/leaderboard`**, admin users/fixtures/ingest, scoring recomputation, guide/charity modules as documented there. Department and badge modules are dormant for launch, not deleted.

### 2.4 Local dev defaults

- **`npm run dev`** → Next.js on **`http://localhost:3001`** (`package.json`).
- **`npm run emulators:start`** → Firebase emulators on **Auth `9099` / Firestore `8080` / Functions `5001`** with persisted local state under **`.local/firebase-emulators/`**.
- Emulator persistence matters: local email/password users, admin claims, and Firestore data now survive normal emulator restarts when started via **`npm run emulators:start`**.
- **`lib/firebase.ts`:** Initializes Firestore, Auth, **`getFunctions(app, "asia-southeast1")`**. There is **no** `connectFunctionsEmulator` / `connectFirestoreEmulator` in this file — **local UI talks to whatever project your `NEXT_PUBLIC_*` env points at** (typically production unless you add emulator wiring).

---

## 3. What is working (expected)

- **Repo builds:** `npm run build` at repo root; **`cd functions && npm run build`** for Functions TypeScript (run before PRs per team rules).
- **Roster integrity:** `npm run validate:teams-seed` should pass after seed edits.
- **Emulator scripts:** `npm run test:badges`, `npm run test:rehearsal` (see `package.json`) when Firebase CLI + emulators are installed and configured.

---

## 4. What is not working or unverified

### 4.1 Production callable from localhost (resolved 2026-05-04)

**Symptom (historical):** Browser reported **CORS** on **`OPTIONS`** / **`POST`** to  
`https://asia-southeast1-worldcup-sweepstake-2026.cloudfunctions.net/…`  
from **`http://localhost:3001`**, plus **`FirebaseError: internal`**.

**Root cause (confirmed in Logs Explorer):** **`textPayload`: “The request failed because billing is disabled for this project.”** Gen2 callables sit on **Cloud Run**, which requires an **active billing account**. Error responses omit **`Access-Control-Allow-Origin`**, so the browser surfaces **CORS** even though the issue is **billing / edge**, not Next.js.

**After billing enabled:** Short-lived **HTTP 429** (“Rate exceeded”) on the same URLs could still produce the same **CORS** symptom; wait and avoid tight refresh loops (dev **Strict Mode** doubles some effects).

**If this regresses:** Logs Explorer → `resource.type="cloud_run_revision"` + `resource.labels.service_name="<functionname lowercase>"` → read **`textPayload`** on the failing **`OPTIONS`** row. **Repo builds (2026-05-04):** `npm run build` and `cd functions && npm run build` both green.

### 4.2 Deploy vs repo drift

Any change under **`functions/src/`** (including the `assignDrawnTeams` error code) is **not live** until functions are deployed. Treat “works in repo” and “works in production” separately.

### 4.3 Fixture data vs 2026 roster

**`npm run audit:fixture-teams`** may still report mismatches where ingest payloads or stored **`matches`** use **2022-era** ids. That is a **data/ops** follow-up, not necessarily a broken build. See runbook + audit script output.

### 4.4 Roster sprint QA row

[`TEAMS-ROSTER-UPDATE-SPRINT.md`](./TEAMS-ROSTER-UPDATE-SPRINT.md) status log has an **operator-run QA smoke** line (Pass/Fail). If that line is still empty, **end-to-end UX against production Firestore** after re-seed was not recorded in-doc.

### 4.5 Working tree / untracked UX bundle

The repo may contain **large untracked** paths (e.g. a duplicated **`docs/sweepstakes-game-ux (1)/`** style tree per local clone). Treat as **reference-only** unless the product owner asks to integrate it; do not assume it is part of the shipped app.

---

## 5. Pointers by task

| Task | Start here |
|------|----------------|
| Admin operations | [`ADMIN-TOOLS.md`](./ADMIN-TOOLS.md) |
| Live tournament ops | [`TOURNAMENT-RUNBOOK.md`](./TOURNAMENT-RUNBOOK.md) |
| Env vars | [`ENV-VARS.md`](./ENV-VARS.md) |
| Firebase surfaces / callables | [`FIREBASE-SURFACE.md`](./FIREBASE-SURFACE.md) |
| Security / headers | [`SECURITY-AUDIT-CHECKLIST.md`](./SECURITY-AUDIT-CHECKLIST.md), [`HTTP-HEADERS.md`](./HTTP-HEADERS.md) |
| Shell / nav convergence | [`SHELL-CONVERGENCE.md`](./SHELL-CONVERGENCE.md) |
| Phased build plan | [`BUILD-PLAN-PHASES.md`](./BUILD-PLAN-PHASES.md) |

**Callable implementation:** `functions/src/getLeaderboard.ts` (and re-export in `functions/src/index.ts`).

---

## 6. Quick commands

```bash
npm run dev                    # Next.js → :3001
npm run emulators:start        # persisted Auth/Firestore/Functions emulators
npm run build
npm run validate:teams-seed
npm run audit:fixture-teams
cd functions && npm run build
firebase deploy --only functions   # from machine with credentials
```

---

## 7. Suggested first session checklist for a new agent

1. Read this file + **`NEW-CONTEXT-HANDOVER.md`** (git/PR non-negotiables).  
2. Confirm **`.env.local`** for `NEXT_PUBLIC_FIREBASE_*` matches the environment you intend to hit.  
3. Run **`npm run build`** and **`cd functions && npm run build`**.  
4. If callable/CORS/`internal` errors from localhost: check **Logs Explorer** on failing **`OPTIONS`** (billing, 429 rate, etc.) — see §4.1.  
5. If touching roster/Firestore teams: **`validate:teams-seed`**, then **`/admin/seed-teams`** flow per **ADMIN-TOOLS**.
6. If local admin access disappears unexpectedly, confirm emulators were started with **`npm run emulators:start`** rather than raw `firebase emulators:start`.

When you update material facts (deploy fixes CORS, QA completed, etc.), bump **Last updated** at the top of this file and add a one-line note under §4 or §3.
