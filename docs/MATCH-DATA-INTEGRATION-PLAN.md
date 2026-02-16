# Match Data Integration Plan

**Goal:** Replace hardcoded "Recent Form" and "Next Match" with real Firestore data

---

## Current State (Hardcoded)

**Location:** `app/dashboard/page.tsx`

**Featured Team (lines 2752-2778):**
```tsx
{/* Recent Form */}
{['W', 'W', 'D', 'W', 'W'].map((result, i) => ...)} // HARDCODED

{/* Next Match */}
<p>vs Mexico</p>  // HARDCODED
<p>Tomorrow 18:00</p>  // HARDCODED
```

**Drawn Teams (lines 2858-2895):**
Same hardcoded pattern repeated for each drawn team.

---

## Target State (Dynamic)

### Implementation Approach

**Option A: Fetch on Expand (Lazy)**
- Fetch match data when user clicks to expand team details
- Pros: Fewer initial queries, faster page load
- Cons: Slight delay when expanding

**Option B: Fetch on Mount (Eager)**
- Fetch match data for all teams on dashboard load
- Pros: Instant display when expanding
- Cons: More initial queries (6 teams max)

**Recommended:** **Option A** (Lazy loading)
- Better performance
- Most users don't expand all teams
- Firestore queries only when needed

### Code Changes Required

**1. Add Match Data State**
```tsx
const [teamMatchData, setTeamMatchData] = useState<Record<string, {
  recentForm: MatchResult[];
  nextMatch: NextMatch | null;
  loading: boolean;
}>>({});
```

**2. Fetch on Expand**
```tsx
const handleTeamExpand = async (teamId: string) => {
  if (expandedTeam === teamKey) {
    setExpandedTeam(null); // Collapse
    return;
  }

  setExpandedTeam(teamKey); // Expand

  // Fetch match data if not already loaded
  if (!teamMatchData[teamId]) {
    setTeamMatchData(prev => ({
      ...prev,
      [teamId]: { recentForm: [], nextMatch: null, loading: true }
    }));

    const [recentForm, nextMatch] = await Promise.all([
      getTeamRecentForm(teamId),
      getTeamNextMatch(teamId)
    ]);

    setTeamMatchData(prev => ({
      ...prev,
      [teamId]: { recentForm, nextMatch, loading: false }
    }));
  }
};
```

**3. Update UI to Use Real Data**
```tsx
{/* Recent Form */}
{teamMatchData[team.id]?.loading ? (
  <div>Loading...</div>
) : teamMatchData[team.id]?.recentForm.length > 0 ? (
  teamMatchData[team.id].recentForm.map((result, i) => ...)
) : (
  <p className="text-muted-foreground text-sm">No matches yet</p>
)}

{/* Next Match */}
{teamMatchData[team.id]?.nextMatch ? (
  <>
    <p>vs {teamsById[teamMatchData[team.id].nextMatch.opponentId]?.name || 'TBD'}</p>
    <p>{formatMatchDate(teamMatchData[team.id].nextMatch.scheduledAt)}</p>
  </>
) : (
  <p className="text-muted-foreground text-sm">No upcoming matches</p>
)}
```

---

## Files to Modify

1. **app/dashboard/page.tsx**
   - Add import: `getTeamRecentForm`, `getTeamNextMatch`, `formatMatchDate`
   - Add state: `teamMatchData`
   - Update: Featured team expand handler
   - Update: Drawn teams expand handler (loop)
   - Replace: Hardcoded form arrays with dynamic data
   - Replace: Hardcoded "vs Mexico" with dynamic opponent

2. **lib/teamMatchData.ts**
   - Already created ✅
   - Functions: `getTeamRecentForm`, `getTeamNextMatch`, `formatMatchDate`, `hasMatchData`

---

## Testing Requirements

### Pre-Tournament (No Matches)
1. Load dashboard
2. Expand featured team
3. **Expected:** "No matches yet" message
4. **Expected:** "No upcoming matches" message

### With 2022 Test Data
1. Import 2022 World Cup matches to Firestore
2. Load dashboard
3. Expand team (e.g., Brazil)
4. **Expected:** Recent form shows W/D/L from last 5 matches
5. **Expected:** Next match shows actual upcoming fixture

### Performance Test
1. Expand 6 teams rapidly
2. **Expected:** No lag, smooth loading states
3. **Expected:** Cached data doesn't refetch

---

## Data Model for Matches

**Firestore Collection:** `matches`

```typescript
{
  matchId: string;
  homeTeamId: string; // Team document ID
  awayTeamId: string; // Team document ID
  homeScore: number | null; // null if not completed
  awayScore: number | null;
  scheduledAt: Timestamp;
  status: "scheduled" | "live" | "completed";
  stage: "group" | "round_16" | "quarter" | "semi" | "final";
  group?: string; // For group stage matches (A-H)
}
```

**Example Match:**
```json
{
  "matchId": "match_001",
  "homeTeamId": "brazil",
  "awayTeamId": "serbia",
  "homeScore": 2,
  "awayScore": 0,
  "scheduledAt": "2022-11-24T19:00:00Z",
  "status": "completed",
  "stage": "group",
  "group": "G"
}
```

---

## Composite Indexes Required

Firestore will require composite indexes for these queries:

**Index 1:** Completed matches for team (home)
- Collection: `matches`
- Fields: `homeTeamId` ASC, `status` ASC, `scheduledAt` DESC

**Index 2:** Completed matches for team (away)
- Collection: `matches`
- Fields: `awayTeamId` ASC, `status` ASC, `scheduledAt` DESC

**Index 3:** Upcoming matches for team (home)
- Collection: `matches`
- Fields: `homeTeamId` ASC, `status` ASC, `scheduledAt` ASC

**Index 4:** Upcoming matches for team (away)
- Collection: `matches`
- Fields: `awayTeamId` ASC, `status` ASC, `scheduledAt` ASC

**Note:** Firestore will provide these index creation URLs when you first run the queries.

---

## Future Enhancements

1. **Cache Match Data:** Store in localStorage to avoid refetching
2. **Real-Time Updates:** Subscribe to match collection for live score updates
3. **Match Details Page:** Click next match → full match preview
4. **Head-to-Head:** Show historical H2H between teams
5. **Form Graph:** Visual chart of last 10 matches

---

## Implementation Checkpoint

**Branch:** Will be included in Phase 2 checkpoint
**Estimated LOC:** ~150 lines modified in dashboard
**Risk:** Low - additive feature, doesn't break existing functionality
**Testing:** Manual + 2022 data verification

---

**Status:** Ready for implementation
**Next:** Modify `app/dashboard/page.tsx` with match data integration
