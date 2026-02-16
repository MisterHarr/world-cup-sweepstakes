# Sprint 4-5 Integration Testing Feedback

**Date:** 2026-02-16
**Branch Tested:** `test/sprints-4-5-integration`
**Tester:** Product Owner
**Status:** Testing Complete - Issues Identified

---

## Executive Summary

Sprint 4 (Error Boundaries) and Sprint 5 (Mobile UX) integration testing revealed **7 critical issues** that need to be addressed before merging to main. These issues range from critical bugs blocking core functionality to important UX enhancements and game design changes.

**Critical Bugs (Must Fix):** 2
**High Priority Enhancements:** 3
**Medium Priority Features:** 2

---

## 🔴 Critical Bugs (Blocking Merge)

### Bug #1: Squad Viewer Permission Denied ⚠️

**Severity:** Critical
**Location:** `functions/src/getSquadDetails.ts:34-39`
**Impact:** Users cannot view other players' teams, breaking core social/competitive feature

**Problem:**
When clicking other players' containers in the leaderboard to view their teams, the following error appears:
```
FirebaseError: You can only access your own squad details.
```

**Root Cause:**
Overly restrictive permission check in `getSquadDetails.ts`:
```typescript
if (requestedUserId !== callerUid && !isAdmin) {
  throw new HttpsError(
    "permission-denied",
    "You can only access your own squad details."
  );
}
```

**Expected Behavior:**
- All authenticated users should be able to view any player's squad (teams)
- This adds excitement and competitive engagement
- The squad drawer UI already exists and is designed for this purpose

**Fix Required:**
Remove the permission check restriction to allow all authenticated users to view squads, OR implement a privacy setting that defaults to "public".

**Files Affected:**
- `functions/src/getSquadDetails.ts`

**Priority:** P0 - Blocks core social feature

---

### Bug #2: Hardcoded Featured Team Points ⚠️

**Severity:** Critical
**Location:** `app/dashboard/page.tsx:2742`
**Impact:** Featured team always shows 45 points regardless of actual performance

**Problem:**
When users sign up or sign in, their chosen featured team displays **45 points** already, even though there have been no games yet. All other teams correctly show zero.

**Root Cause:**
Hardcoded points value in the squad drawer:
```typescript
<p className="text-2xl font-bold text-foreground">45</p>
<p className="text-xs text-muted-foreground">pts</p>
```

**Expected Behavior:**
- Featured team should show actual calculated points based on match results
- Should show 0 points when no matches have been played
- Points should be calculated from team stats (wins, goals, clean sheets, etc.)

**Fix Required:**
Replace hardcoded `45` with actual points calculation from Firestore team data or user score breakdown.

**Files Affected:**
- `app/dashboard/page.tsx` (line 2742)

**Priority:** P0 - Data integrity issue

---

## 🟡 High Priority Enhancements

### Enhancement #3: Hardcoded Team Match Data

**Severity:** High
**Location:** `app/dashboard/page.tsx:2756-2778`
**Impact:** Team details show fake data instead of real tournament information

**Problem:**
When clicking team containers in a player's portfolio, the expanded view shows:
- **Recent Form:** Hardcoded `['W', 'W', 'D', 'W', 'W']` (line 2756)
- **Next Match:** Hardcoded `"vs Mexico"` / `"Tomorrow 18:00"` (line 2777-2778)

**Current Implementation:**
```typescript
{['W', 'W', 'D', 'W', 'W'].map((result, i) => (
  // ... render form badges
))}

<p className="font-medium text-foreground">vs Mexico</p>
<p className="text-xs text-muted-foreground">Tomorrow 18:00</p>
```

**Expected Behavior:**
- **For Dev/Test:** Pull recent form and next match from 2022 World Cup historical data
- **For Production 2026:** Wire to live tournament data via Firestore `matches` collection
- Should dynamically calculate form based on last 5 matches
- Should show actual next scheduled match from fixtures

**Fix Required:**
1. Create data model for match results and fixtures in Firestore
2. Query team's recent matches to calculate form (W/D/L)
3. Query next scheduled match from fixtures collection
4. Display "No matches yet" or "Tournament hasn't started" when appropriate

**Files Affected:**
- `app/dashboard/page.tsx` (lines 2752-2779)
- New: `lib/teamMatchData.ts` (data fetching utilities)

**Priority:** P1 - Important for authenticity and user engagement

---

### Enhancement #4: Transfer Limit Configuration Change

**Severity:** High (Game Design)
**Location:** Multiple files
**Impact:** Game balance and strategy

**Problem:**
Current game design allows **3 transfers** per user. Product owner wants to change this to **2 transfers**.

**Current Implementation:**
```typescript
// lib/userBootstrap.ts:28
remainingTransfers: 3

// firestore.rules:28
&& request.resource.data.remainingTransfers == 3
```

**Requested Change:**
- Reduce maximum transfers from **3 → 2**
- Update all initialization, validation, and documentation

**Additional Question to Clarify:**
> **Do transfers cost different amounts of points depending on team tier?**
> - Current: Flat 15-point penalty per transfer
> - Potential: Variable cost based on team tier (e.g., Tier 1 = 20pts, Tier 5 = 5pts)
> - **AWAITING PRODUCT OWNER DECISION**

**Files Affected:**
- `lib/userBootstrap.ts` (initial transfer count)
- `firestore.rules` (validation rules)
- `functions/scripts/*` (all test files)
- Documentation (tournament runbook, user guides)

**Priority:** P1 - Game design decision, must align before launch

---

### Enhancement #5: Missing Admin Department Tab

**Severity:** Medium
**Location:** `app/dashboard/page.tsx`
**Impact:** Admin users cannot filter leaderboard by their department

**Problem:**
Leaderboard shows department filter tabs for:
- ✅ Primary
- ✅ Secondary
- ✅ Badges
- ❌ **Admin** (missing)

**Expected Behavior:**
- Admin department should have its own filter tab
- Users with `department: "Admin"` should be able to filter leaderboard to see only admin players
- Consistent with signup flow which offers "Admin" as a department option

**Fix Required:**
Add "Admin" department tab to leaderboard filter UI, ensure filtering logic includes admin users.

**Files Affected:**
- `app/dashboard/page.tsx` (department tabs section)

**Priority:** P2 - Completeness, affects admin user experience

---

## 🟢 Medium Priority Features

### Feature #6: Cursor Feedback for Clickable Elements

**Severity:** Medium (UX Polish)
**Location:** Multiple components
**Impact:** User confusion about what's clickable

**Request:**
> "I want the cursor to change to a hand icon for any clickable elements when the user uses a laptop/pc."

**Current State:**
Some clickable elements have `cursor-pointer`, but coverage is inconsistent:
- Found only **7 instances** across 7 files (grep results)

**Requested Enhancement:**
- **Desktop/Laptop:** All interactive elements should show `cursor: pointer` on hover
  - Leaderboard rows
  - Podium items
  - Team containers
  - Department tabs
  - Buttons (already have this)
  - Clickable badges

**Additional Question:**
> **Should mobile devices have vibration feedback on tap?**
> - Requires Web Vibration API (`navigator.vibrate()`)
> - Would enhance mobile tactile feedback
> - **AWAITING PRODUCT OWNER DECISION**

**Files Affected:**
- `app/dashboard/page.tsx` (leaderboard, podium, teams)
- `components/ui/button.tsx` (verify existing)
- All interactive components

**Priority:** P2 - UX polish, improves discoverability

---

### Feature #7: Comprehensive Badge System 🏆

**Severity:** Medium (New Feature)
**Location:** `app/badges/page.tsx` (currently minimal)
**Impact:** Major engagement feature missing

**Request:**
> "I want a comprehensive list of badges that can be earned throughout the tournament - at least 20, but possibly as many as 40 or 50 badges."

**Requirements:**

1. **Badge Discovery Research**
   - Conduct competitive analysis of similar games/apps
   - Research fantasy football, World Cup predictor games, sports apps
   - Identify badge categories and award triggers

2. **Badge Categories (Preliminary Ideas)**
   - **Performance Badges:** Top scorer, podium finisher, perfect week
   - **Portfolio Badges:** Tier diversity, all-star squad, underdog champion
   - **Prediction Badges:** Golden boot picker, final four predictor
   - **Engagement Badges:** Early bird, daily login streak, first transfer
   - **Social Badges:** Most viewed squad, trash talk champion
   - **Event Badges:** Group stage master, knockout king, final prophet
   - **Achievement Badges:** Clean sweep (all teams win), hat-trick hunter

3. **UI/UX Requirements**
   - **All badges visible to all users** (browsable catalog)
   - **Locked/Unearned badges:** Greyed out, low opacity
   - **Earned badges:** Full color, glow effect, animation on unlock
   - **Badge details:** Description, criteria, rarity indicator
   - **Progress tracking:** Show progress toward unlocking (e.g., "5/10 transfers")

4. **Data Model**
   - Firestore collection: `badges` (badge definitions)
   - User field: `earnedBadges: string[]` (badge IDs)
   - Badge unlock events tracked in `badgeEvents` collection

**Action Items:**
- [ ] Research badge systems from similar games (provide report)
- [ ] Propose 20-50 badge list with unlock criteria
- [ ] Design badge visual system (icons, colors, glow effects)
- [ ] Implement badge catalog UI (browsable, filterable)
- [ ] Implement badge unlock logic (Cloud Functions triggers)
- [ ] Add badge notification system (celebrate unlocks)

**Files Affected:**
- `app/badges/page.tsx` (complete redesign)
- New: `lib/badgeDefinitions.ts` (badge catalog)
- New: `functions/src/badgeEngine.ts` (unlock triggers)
- New: `components/BadgeCard.tsx` (badge display component)

**Priority:** P2 - Major feature, but not blocking core gameplay

---

## Testing Status Summary

| Sprint | Feature Area | Test Status | Blocker Issues |
|--------|-------------|-------------|----------------|
| Sprint 4 | Error Boundaries | ✅ Passed | 0 |
| Sprint 4 | Offline Indicator | ✅ Passed | 0 |
| Sprint 4 | Loading States | ✅ Passed | 0 |
| Sprint 5 | Responsive Grids | ✅ Passed | 0 |
| Sprint 5 | Touch Targets | ✅ Passed | 0 |
| Sprint 5 | Mobile Navigation | ✅ Passed | 0 |
| Sprint 5 | Viewport & Safe Areas | ✅ Passed | 0 |
| **Core Feature** | **Squad Viewer** | ❌ **FAILED** | **Bug #1** |
| **Core Feature** | **Score Display** | ❌ **FAILED** | **Bug #2** |

---

## Recommended Action Plan

### Phase 1: Critical Bug Fixes (Before Merge to Main)
**Estimated Effort:** 1 day

1. **Fix Bug #1: Squad Viewer Permissions**
   - Remove restrictive permission check
   - Test with multiple users viewing each other's squads
   - PR: `fix/squad-viewer-permissions`

2. **Fix Bug #2: Hardcoded Featured Team Points**
   - Replace hardcoded 45 with actual score calculation
   - Ensure points show 0 when no matches played
   - PR: `fix/featured-team-points-calculation`

### Phase 2: Game Configuration Updates
**Estimated Effort:** 0.5 days

3. **Enhancement #4: Transfer Limit Change**
   - **DECISION NEEDED:** Confirm 3→2 transfers change
   - **DECISION NEEDED:** Variable transfer costs by tier?
   - Update bootstrap, rules, tests, docs
   - PR: `config/transfer-limit-update`

### Phase 3: Data Wiring (Pre-Launch)
**Estimated Effort:** 2-3 days

4. **Enhancement #3: Team Match Data Integration**
   - Design match data model
   - Implement recent form calculation
   - Implement next match lookup
   - Wire to 2022 test data for development
   - PR: `feature/team-match-data`

### Phase 4: UX Polish & Features (Post-Launch)
**Estimated Effort:** 3-5 days

5. **Enhancement #5: Admin Department Tab**
   - Add admin filter to leaderboard
   - PR: `feature/admin-department-filter`

6. **Enhancement #6: Cursor Feedback**
   - Audit all interactive elements
   - Add `cursor-pointer` consistently
   - **DECISION NEEDED:** Mobile vibration feedback?
   - PR: `ux/cursor-feedback`

7. **Feature #7: Badge System**
   - Research competitive badge systems
   - Design comprehensive badge catalog (20-50 badges)
   - Implement badge UI and unlock engine
   - Epic: Multiple PRs spanning 5-7 days

---

## Decisions Required from Product Owner

1. **Transfer System:**
   - ✅ Confirm change from 3 transfers → 2 transfers
   - ❓ Should transfer costs vary by team tier? (Currently flat 15pts penalty)

2. **Mobile Interactions:**
   - ❓ Should mobile devices vibrate on tap/click?
   - ❓ Any other mobile-specific feedback mechanisms?

3. **Badge System:**
   - ❓ Approve badge research and design phase?
   - ❓ Target number of badges: 20, 30, 40, or 50?
   - ❓ Badge priority: Pre-launch or post-launch feature?

4. **Squad Privacy:**
   - ✅ Confirm all users can view all squads (no privacy restrictions)
   - ❓ Future: Add opt-in privacy setting?

---

## Next Steps

**Immediate (Before Merging Sprints 4-5):**
1. ✅ Testing feedback documented (this file)
2. ⏸️ Awaiting product owner decisions on open questions
3. ⏳ Fix Bug #1 and Bug #2 (critical blockers)
4. ⏳ Re-test integration branch after fixes
5. ⏳ Merge Sprint 4 & 5 PRs to main individually (after clean test)

**Short-term (This Week):**
- Create fix branches for Bug #1 and Bug #2
- Update transfer configuration (after decision)
- Begin team match data integration

**Medium-term (Next 2 Weeks):**
- Badge system research and design
- UX polish (cursors, admin tab)
- Full end-to-end testing with 2022 tournament data

---

**Document Maintained By:** Lead Engineer
**Last Updated:** 2026-02-16
**Status:** Awaiting Product Owner Input on Decisions
