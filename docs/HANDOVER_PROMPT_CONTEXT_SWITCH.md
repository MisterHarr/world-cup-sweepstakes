# Handover Prompt (Context Switch)

Use this prompt to bootstrap a new context window safely and consistently.

```text
Project: world-cup-sweepstakes

Read first (required):
1) /docs/COMMIT_EXECUTION_HANDOVER.md
2) /docs/LEAD_ENGINEER_HANDOVER.md
3) /docs/INDEX.md (or equivalent point-of-truth index)
4) Architecture/roadmap/non-negotiables docs referenced by the handover file

Working directory rule:
- Use /Users/harrison.j/world-cup-sweepstakes-clean as the git source of truth.
- Treat /Users/harrison.j/world-cup-sweepstakes as non-authoritative runtime copy.

Execution constraints:
- One step at a time.
- Ask for explicit "ok" before each next step.
- Group micro-steps into coherent test-backed checkpoints.
- Run full quality gates at each checkpoint before commit.
- Preserve unrelated dirty-worktree changes.
- Never revert user changes.
- Follow PR-based hygiene.

Primary goal:
Continue checkpointed delivery safely with strict git hygiene, starting from post-merge `main`, and execute the current Priority 1 sprint from `docs/PRODUCTION-READINESS-ROADMAP.md`:
- Sprint 1: Accessibility & WCAG 2.1 AA Compliance (P0 - blocks launch)

First action now:
1. Run and summarize:
   - git status -sb
   - git branch --show-current
   - git remote -v
   - git fetch origin --prune
   - git log --oneline --decorate -n 20
   - git log --oneline --decorate origin/main..HEAD (or default branch equivalent)
2. Provide:
   - committed vs uncommitted reality
   - remote vs local delta
   - minimal checkpoint plan (grouped, low-risk, test-backed)
3. Stop and wait for my "ok".
```
