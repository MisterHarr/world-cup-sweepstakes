# Sprint 4-5 Integration Test Checklist

**Branch:** `test/sprints-4-5-integration`
**What's being tested:** Sprints 4 (Error Boundaries) + 5 (Mobile UX)

## Setup
```bash
cd /Users/harrison.j/world-cup-sweepstakes-clean
npm run dev
# Open http://localhost:3001
```

---

## 5-Minute Smoke Test

### Auth Flow (2 min)
- [ ] Sign in with Google
- [ ] Redirected to /department
- [ ] Select department (Primary/Secondary)
- [ ] Redirected to /featured-team
- [ ] Pick a featured team
- [ ] Redirected to /dashboard
- [ ] Dashboard loads without errors

### Dashboard Basics (3 min)
- [ ] Leaderboard shows top 3 podium
- [ ] Leaderboard shows user list
- [ ] Click on a podium user → squad drawer opens
- [ ] Squad drawer shows teams
- [ ] Click backdrop → drawer closes
- [ ] No console errors

---

## 20-Minute Thorough Test

### Sprint 4: Error Boundaries & Resilience

#### Offline Indicator
- [ ] Open DevTools Network tab
- [ ] Set to "Offline"
- [ ] Red banner appears: "You are offline"
- [ ] Set back to "Online"
- [ ] Green banner appears: "Reconnected" (3 seconds)

#### Loading States
- [ ] Navigate to /dashboard
- [ ] See loading skeleton (podium + list)
- [ ] Loading skeleton shows correct heights (h-11 for tabs)

#### Error Boundaries
- [ ] Navigate to non-existent route (e.g., /test-404)
- [ ] See friendly error page (not blank screen)
- [ ] Click "Try Again" or "Reload"

### Sprint 5: Responsive Design & Mobile UX

#### Responsive Grids (Desktop → Mobile)
**Desktop (1920px):**
- [ ] Podium shows 3 columns side-by-side
- [ ] Squad drawer teams show 2 columns
- [ ] Department tabs in horizontal row

**Tablet (768px):**
- [ ] Podium shows 3 columns
- [ ] Squad drawer teams show 2 columns
- [ ] Layout looks good

**Mobile (375px - iPhone):**
- [ ] Podium stacks vertically (1 column)
- [ ] Squad drawer teams stack vertically (1 column)
- [ ] Department tabs scroll horizontally
- [ ] No horizontal page scroll
- [ ] All content visible

**Small Mobile (320px - iPhone SE):**
- [ ] Everything still readable
- [ ] No content cut off
- [ ] No horizontal scroll

#### Touch Targets (Mobile viewport)
**Use DevTools mobile mode (375px width):**
- [ ] Department tabs: Easy to tap (44px+ height)
- [ ] Podium items: Easy to tap
- [ ] Leaderboard rows: Easy to tap
- [ ] All buttons: Easy to tap (not too small)
- [ ] 8px gap between elements (no mis-taps)

#### Mobile Navigation & Modals
**Mobile viewport (375px):**
- [ ] Click leaderboard user → Squad drawer opens
- [ ] Drawer is full-screen width
- [ ] Drawer content scrollable
- [ ] Close button works
- [ ] Click backdrop → drawer closes

#### Viewport & Safe Areas
**Desktop browser:**
- [ ] Check DevTools → Console for errors
- [ ] Pinch zoom works (Cmd+/- or Ctrl+/-)
- [ ] Page zooms correctly

**Simulating iOS (DevTools):**
- [ ] Set device to "iPhone 14 Pro"
- [ ] Check squad drawer doesn't overlap bottom
- [ ] Content respects safe area

### Security Headers (Sprint 3)
**DevTools Network tab:**
- [ ] Navigate to /dashboard
- [ ] Click on document request
- [ ] Check Response Headers:
  - [ ] `Content-Security-Policy` present
  - [ ] `X-Frame-Options: DENY`
  - [ ] `X-Content-Type-Options: nosniff`

### Accessibility (Sprint 1)
**Keyboard navigation:**
- [ ] Tab through department buttons
- [ ] Focus ring visible
- [ ] Enter key selects
- [ ] Tab through leaderboard
- [ ] Enter opens squad drawer
- [ ] Esc closes drawer

**Screen reader (Optional):**
- [ ] Turn on VoiceOver (Cmd+F5 on Mac)
- [ ] Navigate to dashboard
- [ ] Podium announced as "Top 3 leaderboard"
- [ ] Leaderboard items announced correctly

---

## Issues Found

**During testing, note any issues here:**

### Critical (Blocks release):
- [ ] None found

### Major (Should fix):
- [ ] None found

### Minor (Can defer):
- [ ] None found

---

## Next Steps After Testing

**If all tests pass:**
1. Delete this test branch
2. Merge all 4 PRs to main individually
3. Verify main branch
4. Ready for deployment

**If issues found:**
1. Document issues above
2. Create fix branches
3. Re-test integration branch
4. Repeat until clean
