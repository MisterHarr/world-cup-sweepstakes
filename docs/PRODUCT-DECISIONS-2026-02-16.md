# Product Decisions - Sprint 4-5 Testing Follow-up

**Date:** 2026-02-16
**Context:** Post Sprint 4-5 integration testing
**Decision Maker:** Product Owner
**Documented By:** Lead Engineer

---

## Transfer Cost System - APPROVED ✅

**Decision:** Implement tiered transfer cost system based on tier upgrade/downgrade

### Cost Logic

**Principle:** Penalize players for upgrading to higher-tier teams, reward/minimize cost for downgrading

**Cost Matrix:**
- **Upgrading (buying higher tier):** Expensive, scaled by tier gap
  - Tier 4 → Tier 1: Most expensive
  - Tier 3 → Tier 1: Very expensive
  - Tier 4 → Tier 3: Moderately expensive

- **Downgrading (buying lower tier):** Cheap/minimal cost
  - Tier 1 → Tier 4: Minimal cost
  - Tier 2 → Tier 4: Very cheap

- **Lateral (same tier):** Moderate baseline cost

### Implementation Requirements

1. Calculate tier difference: `pickupTier - dropTier`
2. Apply sliding scale penalty:
   - Positive difference (upgrade): Higher cost
   - Negative difference (downgrade): Lower cost
   - Zero difference (lateral): Baseline cost

3. Suggested penalty formula (to be refined):
   ```
   baseCost = 10 points
   tierDifference = pickupTier - dropTier

   if (tierDifference > 0) {
     // Upgrading: penalize heavily
     penalty = baseCost + (tierDifference * 15)
   } else if (tierDifference < 0) {
     // Downgrading: minimal cost
     penalty = baseCost + (tierDifference * 5) // reduces cost
   } else {
     // Lateral: baseline
     penalty = baseCost
   }
   ```

4. Example costs:
   - Tier 4 (drop) → Tier 1 (pickup): 10 + (3 × 15) = **55 points**
   - Tier 3 (drop) → Tier 1 (pickup): 10 + (2 × 15) = **40 points**
   - Tier 2 (drop) → Tier 2 (pickup): 10 + (0 × 15) = **10 points** (lateral)
   - Tier 1 (drop) → Tier 4 (pickup): 10 + (-3 × 5) = **-5 points** (net gain!)

**Note:** Net gain on downgrades may need reconsideration - alternative: minimum cost of 5 points

**Files to Update:**
- `functions/src/transfers.ts` (cost calculation logic)
- `functions/src/executeTransfer.ts` (apply variable cost)
- Documentation explaining transfer cost system to users

**Status:** Approved, pending implementation

---

## Haptic Feedback (Mobile) - APPROVED ✅

**Decision:** Implement haptic feedback with user opt-out setting

### Requirements

1. **Default Behavior:** Haptic feedback enabled by default
2. **User Control:** Settings toggle to disable haptic feedback
3. **Trigger Events:**
   - Tap on leaderboard row
   - Tap on team container
   - Tap on podium item
   - Button clicks
   - Badge unlock (celebratory pattern)
   - Transfer submission (success pattern)

4. **Implementation:**
   - Use Web Vibration API: `navigator.vibrate()`
   - Pattern variations:
     - Single tap: `[10]` (10ms)
     - Success: `[10, 50, 10]` (double pulse)
     - Badge unlock: `[50, 100, 50, 100, 50]` (celebration)
   - Graceful degradation for unsupported browsers
   - Store preference in Firestore: `users/{uid}/preferences/hapticsEnabled`

5. **Settings UI:**
   - Add `/settings` page or settings modal
   - Toggle switch: "Haptic Feedback" (On/Off)
   - Description: "Feel vibrations when tapping on mobile devices"

**Files to Create/Update:**
- New: `lib/haptics.ts` (haptic utility functions)
- New: `app/settings/page.tsx` (settings page)
- `app/dashboard/page.tsx` (add haptic triggers)
- Firestore: Add `preferences` subcollection to users

**Status:** Approved, post-launch implementation

---

## Badge System Scope - APPROVED ✅

**Decision:** Implement comprehensive badge system for dev testing with 2022 data

### Scope

- **Timeline:** Must be complete for dev testing (pre-launch)
- **Target Badge Count:** ~30 badges
- **Rationale:**
  - Not too few (boring, no point)
  - Not too many (overwhelming)
  - Mix of serious achievements and fun/silly badges

### Requirements

1. **Badge Design:**
   - Research competitive fantasy sports/World Cup apps
   - Include mix of:
     - Performance badges (skill-based)
     - Engagement badges (participation)
     - Fun/silly badges (entertainment value)
   - Target: 30 badges (can adjust ±5 based on research)

2. **UI Requirements (Confirmed):**
   - All badges visible to all users (browsable catalog)
   - Locked badges: Greyed out, low opacity
   - Earned badges: Full color, glow effect
   - Badge details: Name, description, unlock criteria, rarity

3. **Testing Requirement:**
   - Must work with 2022 World Cup historical data
   - Must be testable with mock users
   - Badge unlock logic must trigger correctly with historical matches

**Next Steps:**
1. Research badge systems (competitive analysis)
2. Propose 30-badge list with unlock criteria
3. Design badge unlock engine
4. Implement badge catalog UI
5. Test with 2022 data + mock users

**Files to Create:**
- `docs/BADGE-SYSTEM-DESIGN.md` (research + proposed badges)
- `lib/badgeDefinitions.ts` (badge catalog)
- `functions/src/badgeEngine.ts` (unlock triggers)
- `app/badges/page.tsx` (complete redesign)

**Status:** Approved, high priority for pre-launch

---

## Transfer Limit - CONFIRMED ✅

**Decision:** Reduce transfers from 3 → 2

**Rationale:** Game balance, strategic depth

**Implementation:**
- Update initial user bootstrap: `remainingTransfers: 2`
- Update Firestore rules validation
- Update all test fixtures
- Update documentation

**Files to Update:**
- `lib/userBootstrap.ts`
- `firestore.rules`
- All test scripts in `functions/scripts/`
- `docs/TOURNAMENT-RUNBOOK.md`

**Status:** Confirmed, bundled with transfer cost system

---

## Execution Plan - OPTION A (APPROVED) ✅

**Decision:** Fix critical bugs first, then merge Sprints 4-5

### Phase 1: Critical Bug Fixes (This Session)
**Priority:** P0 - Blocking

1. **Bug #1: Squad Viewer Permissions**
   - Remove restrictive permission check
   - Allow all authenticated users to view any squad
   - Test with multiple users
   - Branch: `fix/squad-viewer-permissions`

2. **Bug #2: Hardcoded Featured Team Points**
   - Replace hardcoded 45 with actual score calculation
   - Show 0 when no matches played
   - Branch: `fix/featured-team-points-calculation`

3. **Re-test Integration:**
   - Run full TEST-CHECKLIST.md again
   - Verify bugs fixed
   - Confirm no regressions

4. **Merge to Main:**
   - Merge Sprint 4 & 5 PRs individually
   - Delete test branch
   - Update roadmap status

### Phase 2: Enhancements (Next Session)
**Priority:** P1 - Pre-launch

- Transfer cost system (tiered pricing)
- Transfer limit change (3→2)
- Badge system research & design
- Team match data integration

### Phase 3: Polish (Post-Launch)
**Priority:** P2

- Haptic feedback
- Cursor consistency
- Admin department tab

**Status:** Approved, proceeding with Phase 1

---

## Open Questions / Future Considerations

1. **Transfer Cost Minimums:**
   - Should downgrades have a minimum cost (e.g., 5 points)?
   - Or allow net point gains for strategic downgrades?
   - **Decision pending:** Test with both approaches

2. **Badge Unlock Notifications:**
   - In-app toast notification?
   - Email notification?
   - Push notification (future)?
   - **Decision pending:** Badge system design phase

3. **Privacy Settings:**
   - Should users be able to hide their squad from others?
   - Default to public for maximum engagement
   - **Decision pending:** Post-launch feature consideration

---

**Document Status:** Active
**Next Review:** After Phase 1 completion
**Updates Required:** After badge research, transfer cost testing
