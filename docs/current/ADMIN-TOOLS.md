# Admin Tools Guide

This guide explains how to access and safely use the internal admin tools.

## Access

1. Sign in with your admin Google account.
2. Visit `/admin` for the tools landing page.

## Tools

### Seed Teams

Path: `/admin/seed-teams`

Use this once (or very rarely) to seed the `teams` collection. This writes a full set of teams.

Recommended flow:
1. Confirm you are signed in as admin.
2. Click **Seed Teams**.
3. Verify success message.

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
