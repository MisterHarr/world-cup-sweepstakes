# New Context Window Handover

**Purpose:** Bootstrap new Claude context with all critical workflows and non-negotiables
**Last Updated:** 2026-02-16
**Project:** GIS 2026 World Cup Sweepstakes

---

## 🚀 Quick Start (First 5 Minutes)

### 1. Understand Current State
**Read this first:** [`BUILD-STATUS-NEXT-STEPS.md`](./BUILD-STATUS-NEXT-STEPS.md)

**Key Points:**
- ✅ Core features complete (auth, teams, leaderboard, match data)
- ✅ Recent bugs fixed (contribution points, recent form)
- 🎯 Next priorities clearly listed and prioritized

### 2. Know the Codebase
**Tech Stack:**
- Next.js 14 (App Router)
- Firebase (Auth, Firestore, Cloud Functions)
- TypeScript
- Tailwind CSS

**Key Directories:**
```
/app/                  ← Next.js pages
/components/           ← React components
/lib/                  ← Utilities (firebase, scoring)
/functions/src/        ← Firebase Cloud Functions
/docs/current/         ← Active documentation
/docs/archive/         ← Historical reference
```

---

## ⚠️ NON-NEGOTIABLES (Always Follow)

### 1. Git Workflow - STRICT RULES

#### Branch Naming
```bash
# Feature branches
feature/description-of-work

# Bug fixes
fix/bug-description

# Testing branches
test/description

# DO NOT use:
- main (protected)
- random names
- dates in branch names
```

#### Commit Messages
```bash
# REQUIRED FORMAT:
<type>: <short description>

<optional detailed explanation>

# Types: feat, fix, refactor, docs, test, chore
# Example:
feat: add standalone leaderboard page

Extracted leaderboard from dashboard into dedicated route.
Improves performance and code organization.
```

#### Commit Hygiene
**MUST DO:**
- ✅ Commit after EACH logical unit of work
- ✅ Test builds before committing: `npm run build`
- ✅ Push to remote frequently (don't hoard commits locally)

**NEVER DO:**
- ❌ Commit broken code (build must pass)
- ❌ Amend commits unless explicitly instructed
- ❌ Force push to main/master
- ❌ Skip commit messages
- ❌ Batch unrelated changes in one commit

#### Pull Request Requirements
**Before creating PR:**
1. ✅ Branch builds successfully: `npm run build`
2. ✅ Functions build: `cd functions && npm run build`
3. ✅ No TypeScript errors in console
4. ✅ Manual testing completed
5. ✅ All commits follow required commit message format

**PR Title Format:**
```
<type>: <clear description>

Examples:
feat: standalone leaderboard page
fix: squad viewer permission denied error
refactor: split dashboard into components
```

**PR Description Must Include:**
```markdown
## Changes
- Bullet list of what changed

## Testing
- How it was tested
- What was verified

## Related Issues
- Links to any related bugs/tasks
```

---

### 2. Code Quality Standards

#### TypeScript
- ✅ NO `as any` without very good reason (document why)
- ✅ Use proper types for Firestore responses
- ✅ Export types/interfaces for reuse
- ❌ Ignore TypeScript errors

#### File Organization
- ✅ Keep files under 500 lines when possible
- ✅ Extract large components into separate files
- ✅ Use descriptive file/folder names
- ❌ Create monolithic 3000+ line files

#### Error Handling
- ✅ Try-catch blocks for async operations
- ✅ User-friendly error messages
- ✅ Console.error in development only
- ❌ Silent failures

---

### 3. Firebase & Firestore Rules

#### Cloud Functions
**ALWAYS:**
- ✅ Check `context.auth` in every callable
- ✅ Validate all input parameters
- ✅ Return `{ ok: true, ...data }` format
- ✅ Use HttpsError with appropriate codes
- ✅ Set region: `asia-southeast1`

**NEVER:**
- ❌ Trust client input without validation
- ❌ Expose internal errors to client
- ❌ Skip authentication checks

#### Firestore Security
**ALWAYS:**
- ✅ Use callables for writes (not direct Firestore writes from client)
- ✅ Keep `teams` collection read-only
- ✅ Test Firestore rules with emulator

**NEVER:**
- ❌ Allow open writes from client
- ❌ Expose sensitive user data publicly

#### Composite Indexes
**When adding new queries:**
1. ✅ Run query in development
2. ✅ Copy index URL from error
3. ✅ Update `firestore.indexes.json`
4. ✅ Deploy: `firebase deploy --only firestore:indexes`
5. ✅ Wait 5-15 minutes for index to build

---

### 4. Token Optimization

#### DO:
- ✅ Use Glob/Grep before reading files
- ✅ Read only necessary sections with offset/limit
- ✅ Batch independent tool calls in single message
- ✅ Use Task tool for multi-step research

#### DON'T:
- ❌ Read entire 3000-line files unnecessarily
- ❌ Re-read files you've already seen
- ❌ Use Bash for file reading (use Read tool)
- ❌ Output entire file contents in responses

**Reference:** See `/docs/archive/completed-work/TOKEN-REDUCTION-STRATEGIES.md` for detailed strategies

---

### 5. Documentation Maintenance

#### Update These After Changes:
- **`BUILD-STATUS-NEXT-STEPS.md`** - After completing tasks, mark ✅ complete
- **`ADMIN-TOOLS.md`** - When admin tools change
- **`TOURNAMENT-RUNBOOK.md`** - When live ops procedures change

#### Archive Documents When:
- Task completed → Move to `/docs/archive/completed-work/`
- Plan superseded → Move to `/docs/archive/planning/`
- Testing done → Move to `/docs/archive/testing/`

**NEVER:**
- ❌ Delete documents without archiving
- ❌ Update archived docs (they're frozen)
- ❌ Create loose docs in `/docs/` root

---

## 🎯 Current Development Priority

**Active Roadmap:** [`BUILD-STATUS-NEXT-STEPS.md`](./BUILD-STATUS-NEXT-STEPS.md)

**Top 3 Next Tasks (as of 2026-02-16):**

### 1. Standalone Leaderboard Page (Priority: High)
**Why:** Better UX, faster loading, cleaner code
**Files:** Create `/app/leaderboard/page.tsx`
**Effort:** 4-6 hours

### 2. Complete Squad Details Placeholders (Priority: High)
**Why:** Remove "(placeholder)" text, professional appearance
**Files:** `/app/dashboard/page.tsx` lines 287, 293, 674
**Effort:** 2-3 hours

### 3. Improve Type Safety (Priority: Medium)
**Why:** Catch bugs during development, safer refactoring
**Files:** `/app/admin/fixtures/FixturesPageContent.tsx` (11 instances of `as any`)
**Effort:** 4-5 hours

**Full list with explanations:** See BUILD-STATUS-NEXT-STEPS.md

---

## 📂 Project Structure Reference

### Frontend (`/app/`)
```
app/
├── page.tsx              ← Landing/login page
├── dashboard/page.tsx    ← Main dashboard (MY TEAMS, LEADERBOARD, etc.)
├── featured-team/page.tsx ← Team selection
├── department/page.tsx   ← Department selection
└── admin/               ← Admin tools (protected)
    ├── page.tsx         ← Admin landing
    ├── fixtures/        ← Fixture ingestion
    ├── users/           ← User management
    └── runbook/         ← Live ops runbook UI
```

### Backend (`/functions/src/`)
```
functions/src/
├── index.ts             ← Main exports, featured team, department
├── getLeaderboard.ts    ← Leaderboard callable
├── getSquadDetails.ts   ← Squad viewer callable
├── transfers.ts         ← Transfer system
├── scoring.ts           ← Points calculation
├── ingest.ts            ← Match data ingestion
└── admin.ts             ← Admin claim management
```

### Utilities (`/lib/`)
```
lib/
├── firebase.ts          ← Firebase client config
├── teamMatchData.ts     ← Recent form, next match queries
└── utils.ts             ← Shared utilities
```

---

## 🔧 Common Operations

### Run Development Server
```bash
npm run dev
# Access at http://localhost:3001
```

### Build & Verify
```bash
# Frontend
npm run build

# Functions
cd functions && npm run build && cd ..

# Both must pass before committing
```

### Deploy (Production)
```bash
# Functions only
firebase deploy --only functions

# Indexes only
firebase deploy --only firestore:indexes

# All
firebase deploy
```

### Admin Operations
**Set admin claim:**
```bash
# Via Firebase console or functions
# See /docs/current/ADMIN-TOOLS.md
```

**Seed teams:**
```
http://localhost:3001/admin/seed-teams
```

**Ingest fixtures:**
```
http://localhost:3001/admin/fixtures
```

---

## 🐛 Known Issues & Quirks

### Recent Fixes (Already Complete)
- ✅ Contribution points (Feb 16) - Now uses correct scoring values
- ✅ Featured team 2x multiplier (Feb 16) - Captain teams show double points
- ✅ Recent form display (Feb 16) - Fixed `kickoffTime` field name mismatch

### Current Limitations
- ⚠️ Dashboard is 3,100 lines (needs refactoring)
- ⚠️ Some squad details show placeholder text
- ⚠️ Heavy use of `as any` in admin fixtures page
- ⚠️ No transfer history tracking yet

**See BUILD-STATUS-NEXT-STEPS.md for improvement roadmap**

---

## 📖 Where to Find Information

### "How do I...?"
| Question | Document |
|----------|----------|
| Understand current priorities | [`BUILD-STATUS-NEXT-STEPS.md`](./BUILD-STATUS-NEXT-STEPS.md) |
| Use admin tools | [`ADMIN-TOOLS.md`](./ADMIN-TOOLS.md) |
| Run tournament operations | [`TOURNAMENT-RUNBOOK.md`](./TOURNAMENT-RUNBOOK.md) |
| Understand badge system | [`BADGE-SYSTEM-DESIGN.md`](./BADGE-SYSTEM-DESIGN.md) |

### "Why was X decided?"
| Question | Document |
|----------|----------|
| Past bug fixes | `/docs/archive/completed-work/CRITICAL-BUGS-FIX-STATUS.md` |
| Product decisions | `/docs/archive/completed-work/PRODUCT-DECISIONS-2026-02-16.md` |
| Old roadmaps | `/docs/archive/planning/PRODUCTION-READINESS-ROADMAP.md` |

### "What testing was done?"
| Question | Document |
|----------|----------|
| Sprint 4-5 integration | `/docs/archive/testing/SPRINT-4-5-TESTING-FEEDBACK.md` |
| Quality gate evidence | `/docs/archive/testing/REHEARSAL-LOG.md` |

---

## ⚡ Quick Decision Tree

### "Should I create a new branch?"
**YES** - For any code changes
**NO** - For documentation-only changes on existing branch

### "Should I commit now?"
**YES** if:
- Logical unit of work complete
- Build passes
- Code runs without errors

**NO** if:
- Build broken
- Multiple unrelated changes mixed together
- In middle of refactoring

### "Should I create a PR?"
**YES** if:
- Feature/fix complete
- All commits follow required format
- Builds pass
- Testing done

**NO** if:
- Work in progress
- Builds failing
- Not tested

### "Should I update docs?"
**YES** if:
- Changed admin tools → Update `ADMIN-TOOLS.md`
- Completed roadmap task → Update `BUILD-STATUS-NEXT-STEPS.md`
- Changed live ops → Update `TOURNAMENT-RUNBOOK.md`

**NO** if:
- Just reading code
- Minor tweaks
- Exploring

---

## 🚨 Red Flags (Stop & Ask)

**Stop immediately if you see:**
- 🚫 User asks to delete data without confirmation
- 🚫 Request to skip authentication checks
- 🚫 Request to expose sensitive data
- 🚫 Force push to main branch
- 🚫 Modify archived documents
- 🚫 Deploy without testing

**Ask user before:**
- ⚠️ Making breaking changes to public APIs
- ⚠️ Changing Firebase security rules
- ⚠️ Modifying scoring logic
- ⚠️ Deleting any files/documents
- ⚠️ Large refactors (>500 LOC)

---

## ✅ Context Handover Checklist

**New context should immediately:**
- [ ] Read `BUILD-STATUS-NEXT-STEPS.md` to understand current priorities
- [ ] Review this handover document for workflows
- [ ] Check most recent commits to see what's changed
- [ ] Ask user what they want to work on today

**Before making changes:**
- [ ] Create feature/fix branch with proper naming
- [ ] Verify builds pass before starting
- [ ] Understand which docs to update after changes

**Before committing:**
- [ ] Build passes: `npm run build`
- [ ] Functions build: `cd functions && npm run build`
- [ ] Tested manually
- [ ] Commit message follows format

**Before ending session:**
- [ ] All work committed and pushed
- [ ] Relevant docs updated
- [ ] User informed of next steps

---

## 🔄 Moving Forward

**You asked:** "My understanding is that we're moving to build-status-next-steps?"

**Answer:** ✅ **YES, exactly!**

**OLD approach:** Multiple scattered docs (PRODUCTION-READINESS-ROADMAP, PHASE-2-IMPLEMENTATION-PLAN, etc.)

**NEW approach:** Single source of truth: [`BUILD-STATUS-NEXT-STEPS.md`](./BUILD-STATUS-NEXT-STEPS.md)

**Why this is better:**
- ✅ One document to update
- ✅ Clear priorities
- ✅ ELI5 explanations for each task
- ✅ Estimated effort for each improvement
- ✅ Why each task matters (user benefit + technical benefit)

**Old docs are archived** but preserved for historical context.

---

## 📞 Summary

**This handover gives you:**
1. ✅ **Non-negotiables** - Git workflow, code quality, Firebase rules
2. ✅ **Current priorities** - BUILD-STATUS-NEXT-STEPS.md is the roadmap
3. ✅ **Project structure** - Where to find code and docs
4. ✅ **Common operations** - Build, deploy, admin tasks
5. ✅ **Decision tree** - When to branch, commit, PR, update docs
6. ✅ **Red flags** - What to stop and ask about

**You are now ready to:**
- Take on tasks from BUILD-STATUS-NEXT-STEPS.md
- Follow proper git workflow
- Update relevant docs
- Ask clarifying questions when needed

**Next step:** Ask user which priority task they want to tackle!

---

**Document maintained by:** Development team
**Last major update:** 2026-02-16 (docs cleanup)
**Review frequency:** Monthly or after major changes
