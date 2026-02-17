# Documentation Guide

**Last Updated:** 2026-02-16
**Project:** GIS 2026 World Cup Sweepstakes

---

## 📁 Folder Structure

```
docs/
├── README.md                  ← You are here
├── current/                   ← Active, living documents
├── archive/                   ← Historical reference only
│   ├── completed-work/        ← Finished tasks, fixed bugs
│   ├── planning/              ← Old roadmaps, superseded plans
│   └── testing/               ← Past test reports
└── sweepstakes-game-ux/       ← Design reference files
```

---

## 🎯 Current Documentation (Use These)

Located in `/docs/current/`:

### For New Context Windows
1. **`NEW-CONTEXT-HANDOVER.md`** ⭐ - **START HERE for new Claude sessions**
   - All non-negotiables (Git, PR, commit requirements)
   - Current priorities and roadmap
   - Quick reference for workflows

### Core Operations
2. **`ADMIN-TOOLS.md`** - Admin operations guide
   - Seed teams, fixture ingest, user management
   - Safe workflows for admin tasks

3. **`TOURNAMENT-RUNBOOK.md`** - Live tournament operations
   - Match day procedures
   - Score updates, monitoring
   - Emergency protocols

### Development
4. **`BUILD-STATUS-NEXT-STEPS.md`** - Development roadmap
   - What's complete ✅
   - Next steps prioritized
   - Why each improvement matters

5. **`BADGE-SYSTEM-DESIGN.md`** - Badge achievement system
   - Badge definitions
   - Unlock criteria
   - Implementation plan

---

## 🗃️ Archive (Reference Only)

Located in `/docs/archive/`:

### Completed Work
- **Bug fixes:** `CRITICAL-BUGS-FIX-STATUS.md` - Feb 16 bug resolutions
- **Product decisions:** `PRODUCT-DECISIONS-2026-02-16.md` - Feature decisions
- **Match data integration:** `MATCH-DATA-INTEGRATION-PLAN.md` - Completed ✅
- **Handover docs:** Various context switch and engineer handover notes
- **Process guides:** Git workflow, PR creation, token reduction strategies

### Planning Documents
- **Old roadmap:** `PRODUCTION-READINESS-ROADMAP.md` - Superseded by BUILD-STATUS-NEXT-STEPS
- **Phase 2 plan:** `PHASE-2-IMPLEMENTATION-PLAN.md` - Historical planning doc

### Testing
- **Sprint 4-5 feedback:** `SPRINT-4-5-TESTING-FEEDBACK.md` - Integration test results
- **Rehearsal logs:** `REHEARSAL-LOG.md` - Quality gate evidence

**⚠️ Important:** Archived docs are historical references. Current status is in `/current/` folder.

---

## 📖 Quick Start Guide

### For New Claude Context Windows
**Read this FIRST:**
1. `/current/NEW-CONTEXT-HANDOVER.md` ⭐ - Complete handover with all workflows

### For Developers
**Read in this order:**
1. `/current/NEW-CONTEXT-HANDOVER.md` - Workflows, non-negotiables, current priorities
2. `/current/BUILD-STATUS-NEXT-STEPS.md` - Detailed roadmap
3. `/current/ADMIN-TOOLS.md` - Admin operations
4. `/current/BADGE-SYSTEM-DESIGN.md` - If working on badges

### For Tournament Admins
**Read in this order:**
1. `/current/ADMIN-TOOLS.md` - How to use admin tools
2. `/current/TOURNAMENT-RUNBOOK.md` - Match day procedures

### For Product Owners
**Read in this order:**
1. `/current/BUILD-STATUS-NEXT-STEPS.md` - Roadmap & priorities
2. `/ archive/completed-work/PRODUCT-DECISIONS-2026-02-16.md` - Past decisions

---

## 🧹 Maintenance

### Adding New Docs
- **Active work:** Add to `/current/`
- **Completed tasks:** Add to `/archive/completed-work/` with date suffix
- **Future planning:** Add to `/archive/planning/`

### Archiving Old Docs
When a document is superseded:
1. Move from `/current/` to appropriate `/archive/` subfolder
2. Add date suffix to filename (e.g., `ROADMAP-2026-02-16.md`)
3. Update this README if needed

### Deleting Docs
Only delete documents that are:
- Completely outdated with no historical value
- Duplicates
- Test files that served their purpose

**Never delete:**
- Bug fix records
- Product decisions
- Test evidence
- Design references

---

## 🎨 Design Reference

The `/sweepstakes-game-ux/` folder contains:
- Design mockups
- Component examples
- UI/UX reference materials

These are reference materials for visual design work. See `/archive/docs-legacy/IMPLEMENTATION-PLAN.md` for the original UI transformation plan.

---

## 🔗 Related Documentation

- **Project README:** `/README.md` - Setup & getting started
- **Legacy docs:** `/archive/docs-legacy/` - Original planning documents
- **Tournament runbook (live):** http://localhost:3000/admin/runbook

---

**Questions?** Check `/current/BUILD-STATUS-NEXT-STEPS.md` for current development priorities.
