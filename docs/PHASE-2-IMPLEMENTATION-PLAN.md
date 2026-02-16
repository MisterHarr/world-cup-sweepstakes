# Phase 2 Implementation Plan

**Date:** 2026-02-16
**Status:** Active Development
**Context:** Post Sprint 4-5 merge, pre-launch enhancements

---

## ✅ Phase 1 Complete

- Sprint 4: Error Boundaries & Resilience - **MERGED**
- Sprint 5: Responsive Design & Mobile UX - **MERGED**
- Bug #1: Squad viewer permissions - **FIXED & MERGED**
- Bug #2: Featured team points - **FIXED & MERGED**

**Main branch status:** Up to date with all testing fixes

---

## 🎯 Phase 2: High Priority Pre-Launch Features

### Priority 1: Tiered Transfer Cost System ⭐

**Approved Decision:** Variable transfer costs based on tier upgrades/downgrades

**Implementation Approach:**

1. **Cost Formula Design**
   ```typescript
   baseCost = 10 points
   tierDifference = pickupTier - dropTier

   // Tier scale: 1 (best) → 5 (worst)
   // Upgrading (4→1): Expensive
   // Downgrading (1→4): Cheap

   if (tierDifference < 0) {
     // Upgrading to better tier (PENALIZE)
     penalty = baseCost + (Math.abs(tierDifference) * 15)
   } else if (tierDifference > 0) {
     // Downgrading to worse tier (REWARD)
     penalty = Math.max(5, baseCost - (tierDifference * 3))
   } else {
     // Lateral move (same tier)
     penalty = baseCost
   }
   ```

2. **Example Costs**
   - Tier 4 → Tier 1: 10 + (3 × 15) = **55 points** (expensive upgrade)
   - Tier 3 → Tier 1: 10 + (2 × 15) = **40 points**
   - Tier 2 → Tier 2: **10 points** (lateral)
   - Tier 1 → Tier 3: max(5, 10 - 6) = **5 points** (cheap downgrade)
   - Tier 1 → Tier 5: max(5, 10 - 12) = **5 points** (minimum cost)

3. **Files to Modify**
   - `functions/src/transfers.ts` - Add `calculateTransferCost()` function
   - `functions/src/executeTransfer.ts` - Replace fixed penalty with calculated cost
   - `app/dashboard/page.tsx` - Display variable cost in transfer UI
   - New: `lib/transferCostCalculator.ts` - Shared cost calculation logic

4. **Testing Requirements**
   - Test all tier combinations (1-5 → 1-5 = 25 scenarios)
   - Verify minimum cost floor (5 points)
   - Ensure cost displayed before transfer execution
   - Test with insufficient points (should block transfer)

**Checkpoint:** `codex/transfer-cost-system`

---

### Priority 2: Transfer Limit Change (3 → 2) ⭐

**Approved Decision:** Reduce maximum transfers from 3 to 2

**Implementation Checklist:**

1. **Code Changes**
   - `lib/userBootstrap.ts:28` - Change `remainingTransfers: 3` → `2`
   - `firestore.rules:28` - Update validation `== 3` → `== 2`
   - `functions/scripts/*.cjs` - Update all test fixtures

2. **Documentation Updates**
   - `docs/TOURNAMENT-RUNBOOK.md` - Update transfer limits
   - `README.md` - Update game rules
   - In-app help text (if exists)

3. **Migration Consideration**
   - **Question:** What about existing users with 3 transfers already?
   - **Options:**
     - A) Grandfather existing users (keep their 3)
     - B) Reset all to 2 (may upset users mid-tournament)
     - C) Apply only to new signups
   - **Decision needed:** Pending product owner input

**Checkpoint:** Bundle with Priority 1 in `codex/transfer-system-update`

---

### Priority 3: Badge System (~30 Badges) 🏆

**Approved Decision:** Comprehensive badge system with ~30 badges for pre-launch

#### Step 3A: Research & Design

**Competitive Analysis Sources:**
- Fantasy Premier League (FPL) - Achievements system
- FIFA World Cup Fantasy - Badge mechanics
- ESPN Tournament Challenge - Award badges
- Yahoo Fantasy Sports - Trophy system
- DraftKings - Achievement unlocks

**Research Goals:**
1. Identify common badge categories
2. Find fun/silly badge ideas (user engagement)
3. Determine unlock trigger patterns
4. Study visual presentation (locked/unlocked states)

**Badge Categories (Preliminary):**

1. **Performance Badges (10 badges)**
   - Top Scorer: Finish #1 overall
   - Podium Finisher: Top 3 at end of tournament
   - Weekly Winner: #1 in any single matchday
   - Comeback Kid: Climb 10+ ranks in one day
   - Consistency King: Never drop below top 10
   - Perfect Week: Maximum points in one matchday
   - Century Club: Score 100+ points
   - Half Century: Score 50+ points
   - Early Leader: #1 after matchday 1
   - Final Sprint: Gain 20+ ranks in final week

2. **Portfolio Badges (8 badges)**
   - Tier Master: Have teams from all 5 tiers
   - Underdog Champion: Win with majority Tier 4-5 teams
   - Elite Squad: All teams Tier 1-2
   - No Transfers: Complete tournament without using transfers
   - Transfer Addict: Use all transfers
   - Featured Glory: Featured team scores 30+ points
   - Balanced Portfolio: Each team scores at least 10 points
   - Lucky Draw: Randomly drawn team scores highest

3. **Prediction Badges (6 badges)**
   - Golden Boot Picker: Featured team player wins golden boot
   - Final Four: All teams make semi-finals
   - Group Stage Prophet: Correctly predict all group winners (future feature)
   - Dark Horse: Featured team makes final (Tier 4-5 team)
   - Knock-Out King: All teams advance from group stage
   - Champions Pick: Featured team wins tournament

4. **Engagement Badges (4 badges)**
   - Early Bird: Complete signup before tournament starts
   - Daily Visitor: Log in every day during tournament
   - Social Butterfly: View 10+ other players' squads
   - First Transfer: Execute your first transfer

5. **Fun/Silly Badges (2 badges)**
   - Chaos Agent: Make transfer during live match
   - Risk Taker: Transfer for a team before their crucial match

**Badge Metadata Structure:**
```typescript
interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // URL or icon name
  category: 'performance' | 'portfolio' | 'prediction' | 'engagement' | 'fun';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockCriteria: {
    type: string; // e.g., 'rank', 'score', 'transfer', 'team_result'
    condition: any; // JSON criteria
  };
  points: number; // Bonus points for unlocking
}
```

**Files to Create:**
- `lib/badgeDefinitions.ts` - Badge catalog (30 badges)
- `functions/src/badgeEngine.ts` - Unlock trigger logic
- `app/badges/page.tsx` - Complete redesign
- `components/BadgeCard.tsx` - Badge display component
- `components/BadgeUnlockNotification.tsx` - Celebration UI

#### Step 3B: Implementation

1. **Badge Data Model**
   - Firestore collection: `badges` (badge definitions)
   - User field: `earnedBadges: string[]` (badge IDs with timestamps)
   - Collection: `badgeEvents` (audit log of unlocks)

2. **Unlock Engine**
   - Cloud Function triggers on:
     - Leaderboard updates (performance badges)
     - Transfer events (engagement/portfolio badges)
     - Match results (prediction badges)
   - Idempotent unlock logic (don't award twice)
   - Batch unlock checks (efficient)

3. **UI Features**
   - Badge catalog page (browsable grid)
   - Locked state: Grayscale, 50% opacity, lock icon
   - Unlocked state: Full color, glow effect, unlock timestamp
   - Progress indicators: "5/10 transfers" for progressive badges
   - Filter by category and rarity
   - Sort by: Recent, Rarity, Category

**Checkpoint:** `codex/badge-system-foundation`

---

### Priority 4: Team Match Data Integration ⚡

**Goal:** Replace hardcoded "Recent Form" and "Next Match" with real tournament data

#### Current State (Hardcoded)
```tsx
// app/dashboard/page.tsx:2756
{['W', 'W', 'D', 'W', 'W'].map(...)} // Hardcoded form

// app/dashboard/page.tsx:2777
<p>vs Mexico</p>  // Hardcoded opponent
<p>Tomorrow 18:00</p>  // Hardcoded time
```

#### Target State
- Query team's last 5 matches from Firestore
- Calculate W/D/L based on actual results
- Query next scheduled fixture
- Display "No matches yet" pre-tournament
- Wire to 2022 test data for development

#### Implementation Steps

1. **Data Model**
   ```typescript
   // Firestore: matches/{matchId}
   {
     matchId: string;
     homeTeamId: string;
     awayTeamId: string;
     homeScore: number | null;
     awayScore: number | null;
     scheduledAt: Timestamp;
     status: 'scheduled' | 'live' | 'completed';
     stage: 'group' | 'round_16' | 'quarter' | 'semi' | 'final';
   }
   ```

2. **Query Functions**
   - `getTeamRecentForm(teamId: string): Promise<('W'|'D'|'L')[]>`
   - `getTeamNextMatch(teamId: string): Promise<Match | null>`
   - Cache results in component state (avoid re-fetching)

3. **Files to Create/Modify**
   - New: `lib/teamMatchData.ts` - Match query utilities
   - Modify: `app/dashboard/page.tsx` - Replace hardcoded data
   - New: `functions/src/populateMatches2022.ts` - Test data script

4. **2022 World Cup Test Data**
   - Import historical match results
   - Use for development/testing
   - Verify badge unlocks work with historical data

**Checkpoint:** `codex/team-match-data-integration`

---

## Execution Order

**Session 1 (Current):**
1. Design transfer cost formula ← **START HERE**
2. Implement transfer cost calculation
3. Update transfer limit to 2
4. Test transfer system changes
5. **Checkpoint:** Commit `codex/transfer-system-update`

**Session 2:**
1. Research badge systems (competitive analysis)
2. Design 30-badge catalog
3. Define badge unlock criteria
4. Create badge data structures
5. **Checkpoint:** Documentation ready for review

**Session 3:**
1. Implement badge catalog (`badgeDefinitions.ts`)
2. Build badge unlock engine (Cloud Functions)
3. Redesign badges page UI
4. Test badge unlocks with mock scenarios
5. **Checkpoint:** Commit `codex/badge-system-foundation`

**Session 4:**
1. Define match data model
2. Create match query utilities
3. Import 2022 World Cup test data
4. Wire match data to dashboard
5. Test with historical data
6. **Checkpoint:** Commit `codex/team-match-data-integration`

---

## Quality Gates (Each Checkpoint)

- ✅ `npm run build` (Next.js)
- ✅ `cd functions && npm run build` (Cloud Functions)
- ✅ `npm run lint` (no new errors)
- ✅ TypeScript compilation passes
- ✅ Manual testing with dev server
- ✅ Firebase deploy (functions if changed)

---

## Open Questions

1. **Transfer Limit Migration:**
   - How to handle existing users with 3 transfers?
   - Reset all to 2, or grandfather existing users?

2. **Transfer Cost Display:**
   - Show cost before user clicks transfer button?
   - Display cost breakdown (base + tier penalty)?

3. **Badge Point Bonuses:**
   - Should unlocking badges award points?
   - If yes, how many per rarity tier?

4. **Match Data Source:**
   - Where to source 2022 World Cup data? (API, manual entry, web scrape)
   - Real-time data provider for 2026? (FIFA API, third-party?)

---

**Next Action:** Implement tiered transfer cost system
**Current Branch:** `main` (will create `codex/transfer-system-update`)
