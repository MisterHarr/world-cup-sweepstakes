# User Guide & FAQ

**Last Updated:** 2026-02-22  
**In-App Route:** `/guide`

## Quick Start

1. Sign in on `/` with Google or email/password.
2. Select your department on `/department`.
3. Choose one Featured Team on `/featured-team`.
4. Confirm and reveal your 5 random teams on `/reveal`.
5. Use `/dashboard` for squad management and score tracking.
6. Use `/leaderboard` to compare rank and open squad details.

## Navigation

- `My Teams`: portfolio and score summary.
- `Leaderboard`: ranks by points or by badges.
- `Live`: match-center bracket/status view.
- `Badges`: all achievements (locked + unlocked states).
- `Guide`: how to use the app and scoring logic.
- `Transfer`: squad swap flow (only when transfer window is open).
- `Charity` (optional): visible only if charity feature flag is enabled.

## Scoring Transparency

### Team Points

Each team’s points are calculated as:

`wins*3 + draws*1 + goalsScored*1 + cleanSheets*1 - redCards*1 - yellowCards*0.5`

### User Total Score

User score is calculated as:

`featuredTeamPoints*2 + sum(drawnTeamPoints) - transferPenaltyPoints`

### Transfer Penalty

Transfer cost (penalty points) is:

`max(5, 10 + upgradeSteps*15 - downgradeSteps*3)`

- Upgrading to better tiers costs more.
- Downgrading to weaker tiers is discounted.
- Every transfer records an audit event in `transferEvents`.

## Random Team Assignment Logic

- Featured Team is chosen by the user.
- Drawn teams are generated server-side, not client-side.
- Featured Team is excluded from draw pool.
- Draws enforce unique team IDs (no duplicates).
- `confirmFeaturedTeam` uses a tier-balanced draw target:
  - 1 from Tier 1
  - 1 from Tier 2
  - 2 from Tier 3
  - 1 from Tier 4

## FAQ

### Why can’t I transfer now?

Transfer window is controlled by admin in `/admin/fixtures`. If closed, transfers are blocked.

### Can I transfer my Featured Team?

No. Featured Team is locked after confirmation.

### Why did my points change after transfer?

Transfers incur penalty points and trigger a recompute cycle. Your total score updates after recompute.

### Why does my rank change if I didn’t transfer?

Other users can change scores, and ingest/recompute updates the full leaderboard ranking.

### Are badges trustworthy?

Badge display reads directly from user badge fields and leaderboard badge counts are recomputed from stored badge state. See `/docs/current/BADGES-TEST-PLAN.md` for regression coverage.

