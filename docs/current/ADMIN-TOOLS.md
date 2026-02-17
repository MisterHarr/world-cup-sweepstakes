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
