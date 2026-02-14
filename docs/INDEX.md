# Documentation Index

Last updated: 2026-02-14

## Active Source of Truth (Current Build)

Use these documents in priority order:

1. **`docs/COMMIT_EXECUTION_HANDOVER.md`** - Git workflow and checkpoint hygiene
2. **`docs/LEAD_ENGINEER_HANDOVER.md`** - Operational context and handover state
3. **`docs/PRODUCTION-READINESS-ROADMAP.md`** - Sprint plan for production launch ⭐ NEW
4. **`docs/HANDOVER_PROMPT_CONTEXT_SWITCH.md`** - Context bootstrap prompt template
5. **`docs/TOURNAMENT-RUNBOOK.md`** - Live operations procedures
6. **`docs/REHEARSAL-LOG.md`** - Test evidence and sign-off log
7. **`docs/ADMIN-TOOLS.md`** - Admin tool reference guide
8. **`ops/monitoring/`** - Alerting setup assets (Cloud Monitoring)

## Read Order for New Context

When starting a new session, read in this sequence:

1. `COMMIT_EXECUTION_HANDOVER.md` (workflow rules)
2. `LEAD_ENGINEER_HANDOVER.md` (current state)
3. `PRODUCTION-READINESS-ROADMAP.md` (what to build next)
4. `TOURNAMENT-RUNBOOK.md` (if working on ops/live features)
5. `REHEARSAL-LOG.md` (for test evidence baseline)

## Archived Documents

Historical planning/design references (not authoritative):

- `archive/docs-legacy/` - Previous build status docs, superseded roadmaps
  - `BUILD-STATUS-NEXT-STEPS-2026-02-13.md` (archived 2026-02-14, superseded by PRODUCTION-READINESS-ROADMAP.md)
- `archive/design-reference/` - V0 design exports, UI mockups
- `archive/scripts/` - Legacy automation scripts

**Rule:** Do not use archived files as implementation authority unless explicitly asked.

## Document Maintenance

- Update `PRODUCTION-READINESS-ROADMAP.md` after each sprint completion
- Update `REHEARSAL-LOG.md` after quality gate runs
- Update `LEAD_ENGINEER_HANDOVER.md` after major merges
- Archive superseded docs to `archive/docs-legacy/` with date suffix
