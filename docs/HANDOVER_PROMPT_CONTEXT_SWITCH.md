# Handover Prompt (Context Switch)

Use this prompt to bootstrap a new context window safely and consistently.

```text
Project: world-cup-sweepstakes

Read first (required):
1) /docs/COMMIT_EXECUTION_HANDOVER.md
2) /docs/INDEX.md (or equivalent point-of-truth index)
3) Architecture/roadmap/non-negotiables docs referenced by the handover file

Execution constraints:
- One step at a time.
- Ask for explicit "ok" before each next step.
- Group micro-steps into coherent test-backed checkpoints.
- Run full quality gates at each checkpoint before commit.
- Preserve unrelated dirty-worktree changes.
- Never revert user changes.
- Follow PR-based hygiene.

Primary goal:
Safely migrate long-running local-only work into clean commits and PRs without regressions.

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
