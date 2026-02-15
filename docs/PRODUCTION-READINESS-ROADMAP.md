# Production Readiness Roadmap

Last updated: 2026-02-14

## Overview

This roadmap defines the path to **production-grade robustness** for the World Cup Sweepstakes application. It addresses critical gaps in **accessibility**, **security**, **privacy**, **performance**, and **UX/UI modernity** identified through comprehensive codebase analysis.

**Current State:** Stable pre-production with auth, admin tools, scheduler automation, and transfer flow complete.

**Goal:** Achieve human-level robustness suitable for public launch with 100+ concurrent users.

---

## Sprint Priority Matrix

| Sprint | Focus Area | Priority | Effort | Blocks Launch | Status |
|--------|-----------|----------|--------|---------------|--------|
| 1 | Accessibility & WCAG 2.1 AA | P0 | 2-3d | ✅ YES | ✅ COMPLETE |
| 9 | Data Integrity & Mock Removal | P0 | 2d | ✅ YES | 🔄 CURRENT |
| 2 | Performance Optimization | P1 | 3-4d | ⚠️ Recommended | ⏸️ Pending |
| 3 | Security Hardening & Privacy | P1 | 2d | ⚠️ Recommended | ⏸️ Pending |
| 4 | Error Boundaries & Resilience | P2 | 2d | No | ⏸️ Pending |
| 5 | Responsive Design & Mobile UX | P2 | 3d | ⚠️ Recommended | ⏸️ Pending |
| 6 | Metadata & SEO | P3 | 1d | No | ⏸️ Pending |
| 7 | Observability & Monitoring | P2 | 2d | No | ⏸️ Pending |
| 8 | Progressive Enhancement | P3 | 3d | No | ⏸️ Pending |

**Recommended Launch Gate:** Complete Sprints 1, 9, 2, 3, 5 before public launch.

---

## SPRINT 1: Accessibility & WCAG 2.1 AA Compliance ⭐

**Priority:** P0 (BLOCKING for public launch)
**Effort:** 2-3 days
**Risk Level:** High UX debt, potential ADA compliance issues

### Objectives

1. **Color Contrast Fixes**
   - Audit all tier pills, muted text, status indicators
   - Achieve 4.5:1 minimum contrast ratio for normal text, 3:1 for large text
   - Fix yellow/slate gradients in dashboard leaderboard tiers (`text-yellow-300` on `from-yellow-500/20`)
   - Review `text-muted-foreground` contrast on all backgrounds

2. **Keyboard Navigation**
   - Add focus trap to modals/dialogs (department selector, squad viewer)
   - Implement tab order for department selection, featured team picker
   - Add visible focus indicators (`focus-visible:ring-2 ring-primary`) to all interactive elements
   - Make podium/tier pills keyboard-navigable with arrow keys
   - Ensure escape key closes all modals

3. **ARIA Attributes**
   - Add `aria-live="polite"` to leaderboard live indicator
   - Add `role="status"` to loading skeletons
   - Add `role="alert"` to error messages
   - Add `aria-labelledby` to all form inputs
   - Add `aria-describedby` for validation messages

4. **Semantic HTML**
   - Convert department buttons to proper radio group (`<fieldset>` + `<input type="radio">`)
   - Replace leaderboard `<div>` ranking with `<ol>` ordered list
   - Add `<main>` landmark to all pages
   - Ensure `<form>` elements wrap all form controls

5. **Image Alt Text**
   - Add meaningful alt text to all flag images (e.g., "Brazil flag")
   - Provide text alternatives for trophy/shield icons
   - Add `aria-label` to decorative SVG icons
   - Ensure lucide-react icons have `aria-hidden="true"` when decorative

### Acceptance Criteria

- ✅ Passes axe DevTools audit (0 critical/serious issues)
- ✅ Can navigate entire app with keyboard only (no mouse)
- ✅ Screen reader announces all state changes (tested with VoiceOver/NVDA)
- ✅ All CTAs meet WCAG AA contrast ratio (verified with WebAIM Contrast Checker)
- ✅ Focus indicators visible on all interactive elements
- ✅ Forms can be completed using only keyboard

### Recommended PR Slices

1. **PR 1:** Color contrast fixes (tier pills, status messages, muted text) - ~3-5 files, 100-150 LOC
2. **PR 2:** Keyboard navigation for modals and department selector - ~4-6 files, 150-250 LOC
3. **PR 3:** ARIA labels for leaderboard, live indicator, loading states - ~5-7 files, 100-200 LOC
4. **PR 4:** Semantic HTML (radio groups, ordered lists, landmarks) - ~4-6 files, 150-300 LOC
5. **PR 5:** Alt text for images and icon accessibility - ~8-10 files, 80-150 LOC

### Files Likely Affected

- `app/dashboard/page.tsx` (tier pills, leaderboard, live indicator)
- `app/department/page.tsx` (radio group conversion)
- `app/featured-team/page.tsx` (form labels)
- `components/ui/dialog.tsx` (focus trap)
- `components/ui/button.tsx` (focus styles)
- `components/AuthLandingPage.tsx` (form accessibility)

---

## SPRINT 9: Data Integrity & Mock Removal 🧹

**Priority:** P0 (BLOCKING for production launch)
**Effort:** 2 days
**Risk Level:** Critical (hardcoded data prevents real tournament operation)

### Context

After completing accessibility fixes (Sprint 1), pre-production testing revealed hardcoded/mock data throughout the dashboard and badges pages that must be replaced with actual Firestore data before launch. These issues prevent the app from functioning correctly with real tournament data.

### Objectives

1. **Remove Hardcoded Score Delta**
   - Remove "+12 today" hardcoded text (dashboard line 2691)
   - Calculate actual score delta from historical leaderboard data
   - Store previous score in user document or leaderboard snapshots
   - Display calculated delta or hide if no historical data

2. **Fix Department Filter Tabs**
   - Replace hardcoded "By Engineering" / "By Marketing" with actual department values
   - Use "By Primary", "By Secondary", "By Admin" (matching signup departments)
   - Read available departments from Firestore users collection
   - Dynamically generate filter buttons

3. **Rename Awards Tab to Badges**
   - Change "Awards" button text to "Badges" (dashboard line 552)
   - Ensure disabled state remains until badges functionality is implemented
   - Align with actual badge event naming convention

4. **Fix Team Elimination Status**
   - Remove hardcoded `isEliminated = idx >= 4` logic (dashboard line 2823)
   - Read `isEliminated` from team Firestore documents
   - Only show "Eliminated" badge when team.isEliminated === true
   - Respect actual knockout round results

5. **Remove Mock Team Points**
   - Remove hardcoded points `38`, `22`, `31`, `8` (dashboard line 2859)
   - Calculate actual points from team stats (wins, goals, cards)
   - Use same logic as recomputeScores (featuredPoints × 2 + drawnPoints)
   - Display 0 points for teams with no match data

6. **Make Podium Clickable**
   - Add onClick handler to podium items (lines 435-516)
   - Open squad drawer when clicking 1st, 2nd, or 3rd place users
   - Reuse existing `openDrawerFor(user)` function
   - Add cursor-pointer and hover states

7. **Clean Up Badges Page**
   - Audit `/app/badges/page.tsx` for hardcoded badge data
   - Remove mock badge awards and statistics
   - Display message: "Badges will be awarded during tournament" if no real data
   - Ensure badge logic only triggers from actual match/transfer events

### Acceptance Criteria

- ✅ No "+12 today" text unless calculated from real data
- ✅ Department tabs show "Primary", "Secondary", "Admin"
- ✅ Tab label reads "Badges" not "Awards"
- ✅ Team elimination status matches Firestore `isEliminated` field
- ✅ Team points calculated from actual stats, not hardcoded
- ✅ Clicking podium (1st/2nd/3rd) opens squad drawer
- ✅ Badges page shows no mock data
- ✅ App functions correctly with 2022 World Cup test data + 20 mock users
- ✅ App functions correctly in production with zero matches (pre-tournament)

### Recommended PR Slices

1. **PR 1: Dashboard Data Cleanup** - ~1 file, 250-350 LOC
   - Remove hardcoded score delta
   - Fix department filter tabs
   - Rename "Awards" tab to "Badges"
   - Fix team elimination status (read from Firestore)
   - Remove mock team points (calculate from stats)
   - Make podium clickable

2. **PR 2: Badges Page Cleanup** - ~1 file, 150-250 LOC
   - Remove all hardcoded badge data
   - Display "Badges will be awarded during tournament" if no real data
   - Ensure badge logic only triggers from actual events

### Files Likely Affected

- `app/dashboard/page.tsx` (score delta, department tabs, podium, elimination, points)
- `app/badges/page.tsx` (remove all mock data)
- `lib/dashboardData.ts` (add score delta calculation if needed)

### Testing Requirements

**Test with 2022 World Cup data:**
1. Import 2022 match results into Firestore `matches` collection
2. Create 20 mock users with diverse portfolios
3. Run `recomputeScores`
4. Verify:
   - Department filters work correctly
   - Team elimination reflects actual knockout results
   - Podium is clickable
   - Points match historical 2022 results
   - Badges awarded for historical events

**Test in production mode (pre-tournament):**
1. Delete all matches from Firestore
2. Run `recomputeScores`
3. Verify:
   - All users show 0 points
   - No teams marked as eliminated
   - No "+12 today" text displayed
   - Badges page shows "No badges yet" message
   - Department tabs work with actual signup departments

---

## SPRINT 2: Performance Optimization ⚡

**Priority:** P1 (User experience quality)
**Effort:** 3-4 days
**Risk Level:** Medium (user retention at risk with slow loads)

### Objectives

1. **Fix N+1 Query Pattern** (CRITICAL)
   - Implement squad caching layer in dashboard
   - Batch-load squads for top 10 leaderboard users on mount
   - Add `useMemo` for squad data keyed by user ID
   - Prevent re-fetching on every drawer open

2. **Image Optimization**
   - Replace native `<img>` with Next.js `<Image>` component
   - Add automatic WebP conversion
   - Implement lazy loading for below-fold images (flags, avatars)
   - Set explicit width/height to prevent Cumulative Layout Shift (CLS)
   - Add blur placeholder for team flags

3. **Code Splitting**
   - Dynamic import admin routes (`/admin/*`)
   - Lazy-load modals (department selector, squad viewer)
   - Split Radix UI imports to reduce bundle size
   - Tree-shake `lucide-react` (import individual icons instead of entire library)
   - Remove duplicate animation libraries (`tailwindcss-animate` vs `tw-animate-css`)

4. **Pagination & Virtualization**
   - Implement virtual scrolling for leaderboard (>50 users)
   - Add "Load More" button instead of rendering all 200 users
   - Set default limit to 50 in `getLeaderboard.ts`
   - Use intersection observer for infinite scroll

5. **Real-time Listener Cleanup**
   - Audit all `onSnapshot` calls for unsubscribe logic
   - Add cleanup in `useEffect` return functions
   - Implement connection state management (online/offline indicator)
   - Debounce rapid listener updates

### Acceptance Criteria

- ✅ Lighthouse Performance score > 90 (desktop and mobile)
- ✅ First Contentful Paint (FCP) < 1.5s
- ✅ Largest Contentful Paint (LCP) < 2.5s
- ✅ Cumulative Layout Shift (CLS) < 0.1
- ✅ Leaderboard renders <50 DOM nodes initially
- ✅ Bundle size reduced by >30% (check with `next build`)
- ✅ No memory leaks after 5 minutes of use (check DevTools Memory)

### Recommended PR Slices

1. **PR 1:** Squad caching and batch loading - ~3-4 files, 200-300 LOC
2. **PR 2:** Replace `<img>` with Next.js `<Image>` - ~6-8 files, 150-250 LOC
3. **PR 3:** Code splitting (admin routes + modals) - ~5-7 files, 100-200 LOC
4. **PR 4:** Leaderboard pagination/virtualization - ~3-4 files, 200-350 LOC
5. **PR 5:** Listener cleanup and connection state - ~4-6 files, 150-250 LOC

### Files Likely Affected

- `app/dashboard/page.tsx` (squad caching, pagination)
- `lib/dashboardData.ts` (batch queries)
- `functions/src/getLeaderboard.ts` (limit default)
- `next.config.ts` (image optimization config)
- `package.json` (remove duplicate deps)

---

## SPRINT 3: Security Hardening & Privacy 🔒

**Priority:** P1 (Compliance & trust)
**Effort:** 2 days
**Risk Level:** Medium (data exposure, compliance violations)

### Objectives

1. **Content Security Policy (CSP)**
   - Add CSP headers in `next.config.ts` via middleware
   - Restrict script sources to `'self'`, Firebase CDN, Google Analytics
   - Block inline scripts (migrate to external files if needed)
   - Add `frame-ancestors 'none'` to prevent clickjacking
   - Configure `img-src` to allow Firebase Storage and flag CDN

2. **Remove Debug Statements**
   - Strip all `console.log` from production builds
   - Use conditional logging (`if (process.env.NODE_ENV === 'development')`)
   - Replace sensitive error messages with generic user-facing ones
   - Implement structured logging for admin-only error reporting (Firebase Functions)

3. **Rate Limiting**
   - Add Firebase App Check to all callable functions
   - Implement request throttling in `executeTransfer`, `setDepartment`, `confirmFeaturedTeam`
   - Add user-level rate limits (e.g., max 5 transfers per minute)
   - Return `resource-exhausted` error with retry-after header

4. **Data Minimization**
   - Audit what user data is logged/stored
   - Remove unnecessary portfolio reads in client components
   - Implement field masking for admin views (show only relevant data, not full UIDs in logs)
   - Ensure no PII in Firebase Analytics events

5. **Session Management**
   - Add token refresh logic for long-lived sessions (`getIdToken(true)`)
   - Implement idle timeout (sign out after 30min inactive)
   - Add "Sign out all devices" functionality (revoke refresh tokens)
   - Clear local storage on sign out

### Acceptance Criteria

- ✅ CSP headers deployed and validated (check browser DevTools Network)
- ✅ Zero `console.log` in production bundle (verify with source map explorer)
- ✅ Firebase App Check enabled for all callables (test with invalid token)
- ✅ Security headers pass Mozilla Observatory scan (A+ grade)
- ✅ Rate limiting prevents abuse (test with 10+ rapid requests)
- ✅ Idle timeout works (wait 30min, verify auto sign-out)

### Recommended PR Slices

1. **PR 1:** CSP headers and middleware - ~2-3 files, 100-150 LOC
2. **PR 2:** Remove debug statements and structured logging - ~15-20 files, 50-100 LOC
3. **PR 3:** Firebase App Check integration - ~5-7 files, 150-250 LOC
4. **PR 4:** Rate limiting in callable functions - ~4-6 files, 200-300 LOC
5. **PR 5:** Session management and idle timeout - ~3-5 files, 150-250 LOC

### Files Likely Affected

- `next.config.ts` (CSP headers)
- `middleware.ts` (new file, security headers)
- `functions/src/index.ts` (App Check)
- `functions/src/executeTransfer.ts` (rate limiting)
- `lib/firebase.ts` (App Check client config)
- All client components (remove console.log)

---

## SPRINT 4: Error Boundaries & Resilience 🛡️

**Priority:** P2 (Production stability)
**Effort:** 2 days
**Risk Level:** Low (UX polish, prevents crash loops)

### Objectives

1. **React Error Boundaries**
   - Add top-level Error Boundary in `app/layout.tsx`
   - Add route-level boundaries for dashboard, admin, badges, live
   - Implement fallback UI with "Reload" button and friendly message
   - Log errors to Firebase Analytics (non-PII only: error message, stack, component)

2. **Network Error Handling**
   - Add retry logic for failed Firestore queries (exponential backoff: 1s, 2s, 4s)
   - Implement offline detection banner (use `navigator.onLine` + Firestore events)
   - Show user-friendly messages ("Network issue detected, retrying...")
   - Add manual "Retry" buttons for failed operations

3. **Optimistic Updates**
   - Featured team selection: show confirmation immediately, roll back on error
   - Transfer submission: update UI before backend confirmation
   - Roll back on error with clear notification ("Transfer failed, please try again")
   - Show loading spinner during optimistic update

4. **Suspense Boundaries**
   - Wrap lazy-loaded routes in `<Suspense>` with skeleton fallbacks
   - Add loading states for data-fetching components
   - Implement streaming SSR for faster perceived load (if using Server Components)
   - Add timeout for suspense (fallback after 5s)

### Acceptance Criteria

- ✅ App never shows blank screen on error (always shows fallback UI)
- ✅ All network failures have retry mechanism (tested by disabling network)
- ✅ User sees feedback within 100ms of action (spinner, optimistic update)
- ✅ Error logs captured in Firebase Analytics (verify in console)
- ✅ Suspense timeouts prevent infinite loading states

### Recommended PR Slices

1. **PR 1:** Top-level and route-level error boundaries - ~5-7 files, 200-300 LOC
2. **PR 2:** Network error handling and retry logic - ~6-8 files, 250-350 LOC
3. **PR 3:** Optimistic updates for transfers and featured team - ~3-4 files, 150-250 LOC
4. **PR 4:** Suspense boundaries and loading states - ~8-10 files, 100-200 LOC

### Files Likely Affected

- `app/layout.tsx` (top-level error boundary)
- `app/dashboard/page.tsx` (route-level boundary, retry logic)
- `app/featured-team/page.tsx` (optimistic updates)
- `components/ErrorBoundary.tsx` (new component)
- `lib/firestoreUtils.ts` (new file, retry logic)

---

## SPRINT 5: Responsive Design & Mobile UX 📱

**Priority:** P2 (User reach - 60%+ users expected on mobile)
**Effort:** 3 days
**Risk Level:** Low (high user impact)

### Objectives

1. **Responsive Grids**
   - Convert leaderboard podium to `grid-cols-1 sm:grid-cols-3`
   - Add mobile breakpoints for all fixed layouts
   - Test on 320px (iPhone SE), 375px (iPhone 12), 768px (iPad), 1024px (desktop) viewports
   - Ensure no horizontal scroll on any screen size

2. **Touch Targets**
   - Increase button height to min 44px (`h-11` instead of `h-9`)
   - Add spacing between clickable elements (min 8px gap)
   - Enlarge tap zones for podium/tier pills (min 44x44px)
   - Add padding to links and interactive text

3. **Mobile Navigation**
   - Implement smooth slide-in animation for mobile menu (250ms ease-out)
   - Add swipe gesture to close (optional, use Framer Motion)
   - Fix z-index layering issues with modals (ensure menu overlays correctly)
   - Add backdrop blur to mobile menu

4. **Modal Behavior**
   - Make dialogs full-screen on mobile (<640px)
   - Add bottom sheet pattern for squad viewer (slide up from bottom)
   - Ensure scrollable content in constrained viewports (max-h with overflow-y-auto)
   - Add safe area insets for iOS notch

5. **Viewport Meta**
   - Verify `viewport` meta tag in `app/layout.tsx` (`width=device-width, initial-scale=1`)
   - Add `user-scalable=yes` (don't block pinch zoom for accessibility)
   - Test on iOS Safari, Chrome Android, Samsung Internet
   - Ensure no fixed positioning that breaks on mobile Safari

### Acceptance Criteria

- ✅ All features usable on 320px viewport (tested on real device or BrowserStack)
- ✅ Touch targets pass 44px minimum requirement (verified with DevTools)
- ✅ No horizontal scroll on any page (tested across breakpoints)
- ✅ Mobile menu animates smoothly (<200ms, 60fps)
- ✅ Modals don't break layout on small screens
- ✅ Safe area insets respected on iOS (test on iPhone with notch)

### Recommended PR Slices

1. **PR 1:** Responsive grid layouts - ~6-8 files, 150-250 LOC
2. **PR 2:** Touch target sizing - ~10-12 files, 100-200 LOC
3. **PR 3:** Mobile navigation improvements - ~4-5 files, 200-300 LOC
4. **PR 4:** Modal and dialog mobile behavior - ~5-7 files, 200-350 LOC
5. **PR 5:** Viewport and safe area adjustments - ~3-4 files, 50-100 LOC

### Files Likely Affected

- `app/dashboard/page.tsx` (responsive grids, touch targets)
- `components/app-shell-v0.tsx` (mobile navigation)
- `components/ui/dialog.tsx` (mobile modal behavior)
- `components/ui/button.tsx` (touch target sizing)
- `app/layout.tsx` (viewport meta)

---

## SPRINT 6: Metadata & SEO 🔍

**Priority:** P3 (Discoverability - nice-to-have for internal app)
**Effort:** 1 day
**Risk Level:** Low

### Objectives

1. **Page Metadata**
   - Update title/description in `app/layout.tsx` (remove "Create Next App")
   - Add route-specific titles (`World Cup 2026 - Dashboard | Sweepstakes`)
   - Add Open Graph tags for social sharing (image, title, description)
   - Generate `robots.txt` (disallow `/admin/*`, allow public routes)

2. **Favicon & PWA**
   - Add `favicon.ico`, `apple-touch-icon.png` (180x180)
   - Create `manifest.json` for PWA (name, icons, theme color)
   - Add theme-color meta tag (`#0ea5e9` - primary teal)
   - Add maskable icon for Android

3. **Structured Data** (Optional)
   - Add JSON-LD for organization/event (schema.org/SportsEvent)
   - Implement breadcrumb navigation (`Home > Dashboard > Leaderboard`)

### Acceptance Criteria

- ✅ Unique page titles for all routes
- ✅ Favicon appears in browser tabs
- ✅ Social shares show preview card (test with Twitter Card Validator)
- ✅ `robots.txt` present and valid
- ✅ PWA manifest valid (test with Lighthouse)

### Recommended PR Slices

1. **PR 1:** Metadata and Open Graph tags - ~5-7 files, 100-150 LOC
2. **PR 2:** Favicon, icons, and PWA manifest - ~3-4 files, 50-100 LOC

### Files Likely Affected

- `app/layout.tsx` (metadata)
- `app/dashboard/page.tsx` (page-specific metadata)
- `public/favicon.ico` (new file)
- `public/manifest.json` (new file)
- `public/robots.txt` (new file)

---

## SPRINT 7: Observability & Monitoring 📊

**Priority:** P2 (Operational excellence)
**Effort:** 2 days
**Risk Level:** Low (already has Cloud Monitoring alerting, this enhances)

### Objectives

1. **Client-Side Monitoring**
   - Add Firebase Performance Monitoring SDK
   - Track page load times, API response times (custom traces)
   - Monitor leaderboard render time, squad fetch latency
   - Track bundle download size and cache hit rate

2. **Error Tracking**
   - Integrate Sentry or Firebase Crashlytics
   - Capture unhandled promise rejections
   - Track user flow before errors (breadcrumbs: page views, button clicks)
   - Group errors by component/route

3. **Analytics Events**
   - Log user actions (transfer submitted, team selected, badge earned)
   - Track engagement metrics (time on leaderboard, live page views)
   - Respect user privacy (no PII in events: use hashed UIDs if needed)
   - Implement event sampling for high-volume actions (1% sample rate for page views)

4. **Admin Dashboard**
   - Create admin observability page (`/admin/monitoring`)
   - Show error rate (last 24h), active users (current), transfer activity (last hour)
   - Embed Cloud Monitoring dashboard iframe (if public project)
   - Display recent errors with stack traces (admin-only, non-PII)

### Acceptance Criteria

- ✅ Performance data visible in Firebase console (Performance tab)
- ✅ Error alerts sent to ops email (verified with test error)
- ✅ Admin can view real-time metrics in `/admin/monitoring`
- ✅ Analytics events captured (verify in Firebase Analytics DebugView)

### Recommended PR Slices

1. **PR 1:** Firebase Performance Monitoring integration - ~4-5 files, 150-200 LOC
2. **PR 2:** Error tracking setup (Sentry or Crashlytics) - ~5-6 files, 200-300 LOC
3. **PR 3:** Analytics events implementation - ~8-10 files, 150-250 LOC
4. **PR 4:** Admin monitoring dashboard - ~3-4 files, 250-400 LOC

### Files Likely Affected

- `lib/firebase.ts` (Performance, Analytics SDKs)
- `app/dashboard/page.tsx` (analytics events)
- `app/admin/monitoring/page.tsx` (new route)
- `components/ErrorBoundary.tsx` (error tracking)

---

## SPRINT 8: Progressive Enhancement 🚀

**Priority:** P3 (Future-proofing)
**Effort:** 3 days
**Risk Level:** Low (enhances existing functionality)

### Objectives

1. **Service Worker**
   - Cache static assets (images, fonts, CSS, JS)
   - Implement stale-while-revalidate for API responses (Firestore data)
   - Add offline fallback page (`/offline.html`)
   - Use Workbox for service worker generation

2. **Push Notifications** (Optional)
   - Request permission for match updates (on user opt-in)
   - Send notifications on score changes (via Firebase Cloud Messaging)
   - Respect user opt-out preferences (stored in Firestore `/users/{uid}/preferences`)
   - Add notification settings page (`/settings/notifications`)

3. **Prefetching**
   - Prefetch leaderboard data on login (start fetch immediately after auth)
   - Preload team images on hover (use `<link rel="prefetch">`)
   - Use Next.js `<Link prefetch>` for dashboard routes
   - Implement resource hints (`dns-prefetch`, `preconnect` for Firebase CDN)

4. **Optimistic Rendering**
   - Show skeleton before auth completes (assume signed in, verify after)
   - Render cached leaderboard immediately (update with fresh data in background)
   - Update with fresh data in background (use SWR pattern)
   - Add cache invalidation on user action (transfer, featured team change)

### Acceptance Criteria

- ✅ App loads instantly on repeat visits (<500ms FCP)
- ✅ Offline mode shows cached leaderboard (tested by disabling network)
- ✅ Push notifications work on supported browsers (Chrome, Firefox, Edge)
- ✅ Prefetching reduces perceived load time (measure with Lighthouse)
- ✅ Service worker registered and active (check in DevTools Application tab)

### Recommended PR Slices

1. **PR 1:** Service worker and offline support - ~4-5 files, 300-400 LOC
2. **PR 2:** Push notifications setup - ~6-8 files, 350-500 LOC
3. **PR 3:** Prefetching and resource hints - ~8-10 files, 150-250 LOC
4. **PR 4:** Optimistic rendering and caching - ~5-7 files, 250-400 LOC

### Files Likely Affected

- `public/sw.js` (new file, service worker)
- `app/layout.tsx` (service worker registration)
- `lib/firebase.ts` (FCM setup)
- `app/settings/notifications/page.tsx` (new route)
- `lib/prefetch.ts` (new file, prefetch utilities)

---

## Architecture Analysis Summary

### Current Strengths ✅

1. **Solid Security Foundation**
   - Strong Firestore security rules with proper field validation
   - Backend auth checks in Cloud Functions
   - Admin claim system working correctly

2. **Cost-Safe Operations**
   - Scheduler gated by settings (default: DISABLED)
   - Transfer window enforcement
   - Manual fallback paths validated

3. **Operational Excellence**
   - External alerting configured (Cloud Monitoring)
   - Rehearsal log maintained
   - Admin tools for manual operations

4. **Modern Tech Stack**
   - Next.js 16.1.6 with App Router
   - Radix UI for accessible components (baseline)
   - Tailwind CSS 4 for styling
   - Firebase Admin SDK for backend

### Critical Gaps Identified ⚠️

1. **Accessibility (WCAG 2.1 AA Failures)**
   - Color contrast issues on tier pills, muted text
   - Missing keyboard navigation for modals, department selector
   - Incomplete ARIA labeling
   - Non-semantic HTML (divs instead of lists/radio groups)
   - Missing image alt text

2. **Performance Bottlenecks**
   - N+1 query pattern in squad fetching
   - No image optimization (native `<img>` instead of Next.js `<Image>`)
   - Large bundle size (entire lucide-react library imported)
   - No pagination (renders 200+ leaderboard entries)

3. **Security Hardening Needed**
   - No Content Security Policy (CSP) headers
   - Debug statements in production code
   - No rate limiting on callable functions
   - Missing Firebase App Check

4. **UX/UI Modernity**
   - Responsive design gaps (fixed grids break on mobile)
   - Touch targets below 44px minimum
   - No error boundaries (app crashes on component error)
   - Generic metadata (still says "Create Next App")

### Recommended Execution Order

**For Public Launch (Minimum Viable):**
1. Sprint 1: Accessibility ← **BLOCKS LAUNCH**
2. Sprint 5: Responsive Design ← **60%+ mobile users**
3. Sprint 2: Performance ← **User retention**
4. Sprint 3: Security Hardening ← **Compliance**

**Post-Launch (Operational Excellence):**
5. Sprint 4: Error Boundaries
6. Sprint 7: Observability
7. Sprint 6: Metadata & SEO
8. Sprint 8: Progressive Enhancement

---

## Slice Philosophy (PR Hygiene)

All sprints follow the established PR slicing rules:

- **1 PR = 1 invariant cluster** (e.g., "keyboard nav works for all modals")
- **~100-400 LOC, ~3-10 files** per PR
- **Squash merge** to keep main history clean (1 commit per PR on main)
- **Test evidence** in every PR description:
  - Quality gates: `npm run lint`, `npm run build`, `cd functions && npm run build`, `npm run test:rehearsal`
  - Manual testing: screenshots, accessibility audit reports, Lighthouse scores

**PR Description Template:**

```markdown
## Invariants
- [List what guarantees this PR provides]

## Implementation
- [Brief summary of changes]

## Quality Gates ✅
- ✅ `npm run lint`
- ✅ `npm run build`
- ✅ `cd functions && npm run build`
- ✅ `npm run test:rehearsal`
- ✅ [Sprint-specific test: e.g., axe DevTools scan, Lighthouse score]

## Files Changed
- Modified: [count] files
- New: [count] files

## Merge Strategy
Squash merge to produce 1 commit on `main`.
```

---

## Next Steps

**Current Priority 1 (from BUILD-STATUS-NEXT-STEPS.md):**
> UX finish pass on dashboard and match center (responsive QA + accessibility + performance)

**This roadmap supersedes that priority** with a structured sprint plan.

**Recommended First Action:**
Start Sprint 1, Slice 1: Color contrast fixes for tier pills and status messages.

**Branch naming:** `codex/sprint1-contrast-fixes` (or similar descriptive names)

**Before each sprint:**
1. Checkout `main` and pull latest
2. Create feature branch
3. Make scoped changes
4. Run quality gates
5. Commit and open PR with test evidence
6. Squash merge after review
7. Delete branch and pull main

---

## Alignment with Existing Docs

This roadmap **replaces** `BUILD-STATUS-NEXT-STEPS.md` as the current build authority.

**Docs hierarchy (new):**
1. `COMMIT_EXECUTION_HANDOVER.md` ← Git/workflow rules
2. `LEAD_ENGINEER_HANDOVER.md` ← Operational context
3. `PRODUCTION-READINESS-ROADMAP.md` ← **THIS DOCUMENT (build plan)**
4. `TOURNAMENT-RUNBOOK.md` ← Live ops procedures
5. `REHEARSAL-LOG.md` ← Test evidence log
6. `ADMIN-TOOLS.md` ← Admin tool reference

**To be archived:**
- `BUILD-STATUS-NEXT-STEPS.md` → `archive/docs-legacy/BUILD-STATUS-NEXT-STEPS-2026-02-13.md`

---

## Maintenance

**Update frequency:** After each sprint completion, update:
- This roadmap: Mark sprint as complete, record PR links
- `REHEARSAL-LOG.md`: Add test evidence for each slice
- `LEAD_ENGINEER_HANDOVER.md`: Update "Current Priority" section

**Version control:** Tag major milestones (e.g., `v1.0-launch-ready` after Sprints 1-5 complete)

---

**Last reviewed:** 2026-02-14
**Next review:** After Sprint 1 completion
