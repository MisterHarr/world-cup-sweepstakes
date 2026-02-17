# Badge System Design - World Cup Sweepstakes

**Date:** 2026-02-16
**Target:** ~30 badges for pre-launch
**Research Sources:** FPL, Fantasy Sports, Gamification Best Practices

---

## Research Summary

### Key Findings from Competitive Analysis

**Fantasy Premier League (FPL) 2025/26:**
- [FPL Challenge Rank Badges](https://www.premierleague.com/en/news/4364264/how-to-play-fpl-challenge-in-202526): 8 rank tiers (Bronze → Legend)
- Performance-based weekly progression
- Top 1% earn "Legend" status
- [Custom team badges](https://www.premierleague.com/en/news/4362141) using Adobe Express

**Gamification Research:**
- [87% of badge earners report higher engagement](https://www.scavify.com/gamification/gamification-badges)
- [PBL Triad](https://www.tandfonline.com/doi/full/10.1080/16184742.2024.2301970): Points, Badges, Leaderboards drive motivation
- [Badge types](https://www.nudgenow.com/blogs/badges-for-gamification-motivation-learning): Achievement, Participation, Loyalty, Event

**ESPN Tournament Challenge:**
- [Focus on leaderboards](https://support.espn.com/hc/en-us/articles/360040752191) and prize eligibility
- Perfect bracket tracking
- Group-based competition

### Design Principles

1. **Visible Progress**: Badges turn abstract progress into tangible achievement
2. **Social Status**: Badges can be displayed and shared
3. **Engagement Loop**: Unlock mechanics encourage repeated engagement
4. **Mix of Difficulty**: Easy (participation), Medium (skill), Hard (rare)
5. **Fun + Serious**: Balance competitive achievements with silly/entertaining badges

---

## Badge Catalog (30 Badges)

### Category 1: Performance Badges (8 badges)
**Focus:** Competitive achievement based on leaderboard performance

| Badge ID | Name | Description | Unlock Criteria | Rarity | Points |
|----------|------|-------------|-----------------|--------|--------|
| `perf_champion` | **Champion** 🏆 | Tournament victor | Finish #1 overall | Legendary | 100 |
| `perf_podium` | **Podium Finisher** 🥇 | Top 3 glory | Finish in top 3 | Epic | 50 |
| `perf_top10` | **Elite Ten** 💎 | Top tier player | Finish in top 10 | Rare | 25 |
| `perf_weekly_winner` | **Week Winner** ⚡ | Weekly dominance | #1 in any matchday | Rare | 20 |
| `perf_comeback` | **Comeback Kid** 📈 | Epic recovery | Climb 10+ ranks in one day | Rare | 15 |
| `perf_consistent` | **Consistency King** 👑 | Steady performance | Never drop below top 10 | Epic | 30 |
| `perf_century` | **Century Club** 💯 | Triple digits | Score 100+ points total | Common | 10 |
| `perf_perfect_week` | **Perfect Week** ✨ | Maximum points | Score maximum possible in one matchday | Legendary | 50 |

### Category 2: Portfolio Badges (7 badges)
**Focus:** Strategic team building and portfolio management

| Badge ID | Name | Description | Unlock Criteria | Rarity | Points |
|----------|------|-------------|-----------------|--------|--------|
| `port_tier_master` | **Tier Master** 🎯 | Diversity champion | Have teams from all 5 tiers | Rare | 15 |
| `port_underdog` | **Underdog Champion** 🐕 | Low-tier hero | Win with majority Tier 4-5 teams | Epic | 40 |
| `port_elite_squad` | **Elite Squad** 💎 | Premium portfolio | All teams Tier 1-2 | Rare | 20 |
| `port_no_transfers` | **Transfer Virgin** 🚫 | Strategic discipline | Complete tournament with 0 transfers | Epic | 35 |
| `port_transfer_addict` | **Transfer Addict** 🔄 | Used all transfers | Use both transfers | Common | 5 |
| `port_featured_glory` | **Featured Glory** ⭐ | Star performer | Featured team scores 30+ points | Rare | 15 |
| `port_balanced` | **Balanced Portfolio** ⚖️ | Well-rounded | Each team scores 10+ points | Rare | 20 |

### Category 3: Prediction Badges (6 badges)
**Focus:** Predicting tournament outcomes and team performance

| Badge ID | Name | Description | Unlock Criteria | Rarity | Points |
|----------|------|-------------|-----------------|--------|--------|
| `pred_golden_boot` | **Golden Boot Picker** 🥾 | Top scorer prophet | Featured team player wins golden boot | Legendary | 100 |
| `pred_final_four` | **Final Four** 🏆 | Semi-final sage | All teams make semi-finals | Legendary | 75 |
| `pred_dark_horse` | **Dark Horse** 🐴 | Unlikely finalist | Tier 4-5 featured team makes final | Epic | 50 |
| `pred_knockout_king` | **Knockout King** 👑 | Group stage master | All teams advance from group stage | Rare | 25 |
| `pred_champions_pick` | **Champions Pick** 🥇 | Tournament winner | Featured team wins tournament | Legendary | 150 |
| `pred_group_winner` | **Group Prophet** 📊 | Group stage expert | Featured team wins their group | Common | 10 |

### Category 4: Engagement Badges (5 badges)
**Focus:** Participation, activity, and community engagement

| Badge ID | Name | Description | Unlock Criteria | Rarity | Points |
|----------|------|-------------|-----------------|--------|--------|
| `engage_early_bird` | **Early Bird** 🐦 | Day one participant | Complete signup before tournament starts | Common | 5 |
| `engage_daily_visitor` | **Daily Devotee** 📅 | Dedicated fan | Log in every day during tournament | Rare | 20 |
| `engage_social` | **Social Butterfly** 🦋 | Community explorer | View 10+ other players' squads | Common | 10 |
| `engage_first_transfer` | **First Transfer** 🔄 | Transfer initiated | Execute your first transfer | Common | 5 |
| `engage_squad_stalker` | **Squad Stalker** 👀 | Obsessive viewer | View 25+ squad details | Rare | 15 |

### Category 5: Fun/Silly Badges (4 badges)
**Focus:** Entertainment, humor, lighthearted achievements

| Badge ID | Name | Description | Unlock Criteria | Rarity | Points |
|----------|------|-------------|-----------------|--------|--------|
| `fun_chaos_agent` | **Chaos Agent** 🎲 | Live transfer madness | Make transfer during live match | Rare | 10 |
| `fun_risk_taker` | **Risk Taker** 🎰 | Dangerous timing | Transfer before team's crucial match | Common | 5 |
| `fun_unlucky` | **Unlucky Thirteen** 🔮 | Cursed number | Finish exactly 13th place | Rare | 10 |
| `fun_nearly_perfect` | **So Close!** 😅 | Almost perfection | Finish 2nd place (not podium badge) | Epic | 25 |

---

## Badge Data Model

### Firestore Structure

**Collection:** `badges`
```typescript
{
  id: string; // e.g., "perf_champion"
  name: string;
  description: string;
  icon: string; // emoji or URL
  category: "performance" | "portfolio" | "prediction" | "engagement" | "fun";
  rarity: "common" | "rare" | "epic" | "legendary";
  unlockCriteria: {
    type: string; // e.g., "rank", "score", "portfolio_composition", "transfer_count"
    condition: object; // JSON criteria specific to type
  };
  pointsAwarded: number; // Bonus points for unlocking
  version: string; // e.g., "v1" for future rule changes
}
```

**User Field:** `users/{uid}`
```typescript
{
  earnedBadges: [
    {
      badgeId: string;
      unlockedAt: Timestamp;
      matchdayUnlocked?: number; // Optional: which matchday
    }
  ]
}
```

**Audit Collection:** `badgeEvents`
```typescript
{
  userId: string;
  badgeId: string;
  badgeName: string;
  unlockedAt: Timestamp;
  triggerType: string; // "leaderboard_update", "transfer", "match_result"
  metadata: object; // Context-specific data
}
```

---

## Unlock Trigger System

### Trigger Types and Implementation

**1. Leaderboard-Based Triggers**
- Fire on: `recomputeScores` completion
- Check: Final rank, weekly rank, rank changes
- Badges: `perf_*`, `fun_unlucky`, `fun_nearly_perfect`

**2. Portfolio-Based Triggers**
- Fire on: User signup completion, transfer execution
- Check: Team tiers, featured team, portfolio composition
- Badges: `port_*`

**3. Match Result Triggers**
- Fire on: Match completion, tournament end
- Check: Team performance, tournament outcomes
- Badges: `pred_*`, `port_featured_glory`

**4. Engagement Triggers**
- Fire on: User actions (login, squad view, transfer)
- Check: Action counts, timestamps
- Badges: `engage_*`, `fun_chaos_agent`

### Badge Unlock Function (Cloud Function)

**Location:** `functions/src/badgeEngine.ts`

```typescript
// Triggered by various events
export async function checkBadgeUnlocks(params: {
  userId: string;
  triggerType: "leaderboard" | "transfer" | "match" | "engagement";
  context: any;
}) {
  const { userId, triggerType, context } = params;

  // Get user data
  const user = await getUserData(userId);
  const currentBadges = user.earnedBadges?.map(b => b.badgeId) || [];

  // Get badge definitions matching trigger type
  const eligibleBadges = await getBadgesByTriggerType(triggerType);

  // Check each badge's unlock criteria
  const newlyUnlocked: string[] = [];

  for (const badge of eligibleBadges) {
    if (currentBadges.includes(badge.id)) continue; // Already unlocked

    if (await checkUnlockCriteria(badge, user, context)) {
      await awardBadge(userId, badge.id);
      newlyUnlocked.push(badge.id);
    }
  }

  return { unlocked: newlyUnlocked };
}
```

---

## UI/UX Requirements

### Badge Catalog Page (`/badges`)

**Layout:**
- Grid display (3-4 badges per row on desktop, 2 on mobile)
- Filter by: Category, Rarity, Unlocked/Locked
- Sort by: Rarity, Recent, Name

**Badge Card (Locked):**
- Grayscale icon
- 50% opacity
- Lock icon overlay
- Name visible
- Description: "???" or hint
- Unlock criteria shown

**Badge Card (Unlocked):**
- Full color icon
- Glow effect (CSS: `box-shadow`)
- Unlock timestamp: "Unlocked 2 days ago"
- Full description
- Points awarded badge

**Badge Details Modal:**
- Large icon
- Full description
- Unlock criteria (detailed)
- Rarity indicator (color-coded)
- Unlock statistics: "X% of players have this"
- Share button (social media)

### Badge Unlock Notification

**Toast Notification:**
```tsx
<Toast variant="success">
  <div className="flex items-center gap-4">
    <div className="text-4xl">{badge.icon}</div>
    <div>
      <p className="font-bold">Badge Unlocked!</p>
      <p>{badge.name}</p>
      <p className="text-sm">+{badge.pointsAwarded} points</p>
    </div>
  </div>
</Toast>
```

**Animation:**
- Slide in from top-right
- Glow pulse effect
- Auto-dismiss after 5 seconds
- Click to view badge details

### Profile Badge Display

**User Profile:**
- Show top 3 rarest badges
- "View all badges" link → `/badges`
- Badge count indicator: "15/30 badges"

**Leaderboard:**
- Show 1 featured badge next to username
- User can select which badge to display
- Rare badges take priority

---

## Rarity Tiers

| Rarity | Color | Unlock Rate | Examples |
|--------|-------|-------------|----------|
| Common | Gray | 60-80% | Early Bird, First Transfer |
| Rare | Blue | 20-40% | Top 10, Tier Master |
| Epic | Purple | 5-15% | Podium, Underdog Champion |
| Legendary | Gold | <5% | Champion, Champions Pick |

---

## Points System

**Badge points are bonus rewards** added to user's total score on unlock.

- Common: 5-10 points
- Rare: 15-25 points
- Epic: 30-50 points
- Legendary: 75-150 points

**Rationale:** Encourages engagement, rewards achievement, doesn't drastically affect competitive balance.

---

## Implementation Phases

### Phase 1: Foundation (Current Sprint)
- Create badge definitions file
- Design badge data model
- Implement badge catalog UI (locked/unlocked states)

### Phase 2: Unlock Engine
- Build badge checking logic
- Integrate with existing triggers (leaderboard, transfers)
- Create badge event logging

### Phase 3: Polish
- Add unlock notifications
- Implement progress tracking ("5/10 transfers")
- Add social sharing features

---

## Testing Strategy

**Test Scenarios:**

1. **Leaderboard Badges:**
   - User finishes #1 → Champion unlocked
   - User climbs from #20 → #8 → Comeback Kid unlocked

2. **Portfolio Badges:**
   - User has teams from T1, T2, T3, T4, T5 → Tier Master unlocked
   - User completes tournament with 0 transfers → Transfer Virgin unlocked

3. **Engagement Badges:**
   - User views 10 squads → Social Butterfly unlocked
   - User logs in daily for 7 days → Daily Devotee unlocked

4. **Edge Cases:**
   - Badge already unlocked → No duplicate award
   - Multiple badges unlocked simultaneously → All awarded
   - Badge criteria met before system launch → Retroactive unlock?

---

## Future Enhancements

1. **Seasonal Badges:** Tournament-specific (World Cup 2026 badges)
2. **Hidden Badges:** Unlock criteria not revealed until earned
3. **Badge Tiers:** Bronze/Silver/Gold versions (e.g., Squad Stalker I, II, III)
4. **Team Badges:** Collective achievements for departments
5. **Time-Limited Badges:** Available only during specific periods

---

## Sources

Research based on:
- [Fantasy Premier League Challenge](https://www.premierleague.com/en/news/4364264/how-to-play-fpl-challenge-in-202526)
- [FPL Custom Badges](https://www.premierleague.com/en/news/4362141)
- [Gamification Badge Types](https://www.scavify.com/gamification/gamification-badges)
- [Fantasy Sports Gamification Research](https://www.tandfonline.com/doi/full/10.1080/16184742.2024.2301970)
- [Badge Engagement Statistics](https://www.nudgenow.com/blogs/badges-for-gamification-motivation-learning)
- [ESPN Tournament Challenge](https://support.espn.com/hc/en-us/articles/360040752191)

---

**Next Steps:**
1. Review and approve badge catalog
2. Implement `lib/badgeDefinitions.ts`
3. Build badge unlock engine
4. Design badge UI components
5. Test with 2022 World Cup data

**Status:** Design Complete, Awaiting Implementation
**Last Updated:** 2026-02-16
