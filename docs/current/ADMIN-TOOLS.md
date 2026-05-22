# Admin Tools Guide

This guide explains how to access and safely use the internal admin tools.

## Access

1. Sign in with your admin Google account.
2. Visit `/admin` for the tools landing page.

## Tools

### Seed Teams

Path: `/admin/seed-teams`

Writes the current app **`TEAMS_SEED`** into Firestore **`teams/{teamId}`** using **`setDoc(..., merge: true)`** — it updates/creates docs but **does not delete** documents whose ids were removed from the seed (e.g. retired `PO_*` placeholders). After a roster change, run **Remove orphan team docs** on that page to delete any `teams/{id}` not in the current seed (admin-only).

Recommended flow:
1. Confirm you are signed in as admin.
2. Emulator or staging first: click **Seed Teams**, then **Remove orphan team docs** if ids were retired.
3. Verify status messages.
4. Production: same order when you intend to align live data; confirm no user portfolios still reference a doc you are about to delete.

### Roster change: user documents (retired `teamId`s)

If anyone confirmed a squad while Firestore still had **placeholder** team ids (`PO_UE_D`, `PO_UE_A`, `PO_UE_C`, `PO_UE_B`, `PO_FIFA_2`, `PO_FIFA_1`), those strings can still appear under **`users/{uid}`** in:

- `portfolio[].teamId`
- `entry.featuredTeamId`
- `entry.drawnTeamIds[]`

**Detection (examples):**

- **Firebase console:** Export `users` or search in your analytics pipeline for the literal strings `PO_UE_` / `PO_FIFA_`.
- **Emulator:** Inspect `users` after rehearsal batches.

**Remediation (pick one per user):**

1. **Map in place** — Edit the user document so each retired id is replaced by the final nation id (see **`WORLD-CUP-2026-ROSTER.md`** / sprint placeholder map): e.g. `PO_UE_D` → `CZE`, …  
2. **Reassign via admin** — Use **`/admin/users`** and the **`adminAssignTeamsToUser`** flow (if you use it) to set a valid featured + drawn set, then ensure `entry` / `portfolio` stay consistent with your product rules.  
3. **Reset entry** — If rules allow, clear `entry` and have the user go through featured-team / confirm again (only with product approval).

After edits, run **Recompute Leaderboard** from **`/admin/fixtures`** if scores look wrong.

### Seed Mock Users (Load Rehearsal)

Path: `/admin/users`

Use this to generate many trial users for manual UX/load rehearsals.

What it does:
- Creates Firebase Auth users (email/password).
- Creates `users/{uid}` docs with department + confirmed squad.
- Marks `hasSeenReveal: true` so seeded users can go straight to dashboard.
- Recomputes leaderboard after seeding.

Recommended flow:
1. Click **Load Users** first.
2. In **Mock User Batch Seeding**, set:
   - `Count` (recommended: `24-60`)
   - `Departments` (`Round Robin` recommended)
3. Click **Seed Mock Users** and confirm.
4. Verify status includes:
   - created count
   - failed count
   - batch tag
5. Click **Load Users** again and confirm new users appear.

Default seeded login password:
- `Test1234!`

### Fixture Ingest

Path: `/admin/fixtures`

This is for testing live updates using historical data.

**Roster alignment:** Ingested rows use `homeTeamId` / `awayTeamId` from **`functions/src/fixtures/*.json`**. After you seed **2026** teams from `/admin/seed-teams`, run **`npm run audit:fixture-teams`** (repo root) to see which fixture ids are missing from `TEAMS_SEED`. The bundled **2022** files will report many gaps by design until you replace or trim them for 2026.

Options:
- **Max matches**: Only ingest the first N fixture matches.
- **Cutoff ISO timestamp**: Only ingest matches with kickoff time <= cutoff.

Safe flow:
1. Click **Preview Selection** to confirm how many matches will be ingested.
2. Check the confirmation checkbox.
3. Click **Run Fixture Ingest**.
4. Review the success message and the **Leaderboard Status** panel.

### Recompute Leaderboard

Use this if you need to force a refresh of scores without ingesting new matches.

Recommended flow:
1. Click **Recompute Leaderboard**.
2. Verify the success message and **Leaderboard Status** update.

## Notes

- These tools are **admin-only**.
- They are **manual** and **on-demand** to avoid accidental costs.
- They do not appear in the public UI.

## Route gating matrix (C6)

| Route | Current gate |
|------|--------------|
| `/admin` | Client-side auth state + `admin` custom claim check |
| `/admin/users` | Client-side auth state + `admin` custom claim check; server callable endpoints also require admin |
| `/admin/fixtures` | Client-side auth state + `admin` custom claim check; backend callables require admin |
| `/admin/seed-teams` | Client-side auth state + `admin` custom claim check |
| `/admin/runbook` | Client-side auth state + `admin` custom claim check (**added 2026-03-26**) |

## Security note

- UI gating is a convenience layer.
- Real authority is enforced in Cloud Functions (`requireAdmin` or admin-claim checks in callable handlers).
