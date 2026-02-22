# Badges Test Plan

**Last Updated:** 2026-02-22  
**Owner:** Engineering  
**Scope:** Badge count correctness + `/badges` UX validation

## Automated Tests (Runnable)

### Command

```bash
npm run test:badges
```

### What This Verifies

- `recomputeScores` handles badge counts correctly for all currently supported user schemas:
  - `earnedBadges` array
  - `badges` array
  - `badges` map/object
- Locked entries (`unlocked: false`) are not counted.
- `unlockedAt` values are counted for:
  - Firestore `Timestamp` object
  - ISO date string
- Leaderboard rows contain expected `badgeCount` values after recompute.

### Files

- `/functions/scripts/test-badge-count-regression.cjs`
- `/functions/src/scoring.ts`

## Manual UX Test Script (Run by Product)

### Preconditions

1. App running: `npm run dev`
2. Admin account ready
3. One regular user account ready (or create one with email auth)

### Scenario A: Locked Catalog Baseline

1. Sign in as a user with no badge data in `users/{uid}`.
2. Open `/badges`.
3. Verify:
   - Header shows `0/30 unlocked`.
   - All badges render in locked visual state.
   - Rarity filters (`All`, `Uncommon`, `Rare`, `Epic`, `Legendary`) switch views without layout breakage.

### Scenario B: Unlock Visibility

1. In Firestore, edit `users/{uid}` and add:
   - `badges.pred_group_winner = true`
   - `badges.port_tier_master = { unlocked: true }`
   - `badges.perf_top10 = { unlockedAt: "2026-02-22T10:00:00Z" }`
2. Refresh `/badges`.
3. Verify:
   - `3/30 unlocked` is shown.
   - Those three cards are visually brighter/unlocked.
   - Other cards remain locked.

### Scenario C: Filter and Count Integrity

1. Click each rarity filter.
2. Verify:
   - Count chips per filter are plausible and stable.
   - Only matching rarity cards are shown.
   - No duplicate controls or clipped pills on mobile width (`360x780`).

### Scenario D: Leaderboard Badges Ranking

1. Open `/leaderboard`.
2. Click `Badges` tab.
3. Verify:
   - Ranking changes based on badge totals (not points).
   - Podium/list and pagination still work.

## Pass/Fail Recording

Record findings in:

- `/docs/current/UI-UX-MANUAL-QA-RUN-2026-02-18.md`
- `/docs/current/UI-UX-POLISH-BACKLOG.md`

