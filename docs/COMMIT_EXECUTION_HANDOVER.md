# Commit Execution Handover

## 1) Scope Lock
- Current scope: Commit and PR-hygiene for long-running local work already built in this repo.
- Out of scope: New feature expansion unless explicitly requested after hygiene baseline is complete.
- Quality bar: no regressions, robust and future-proof changes only.

## 2) Point-of-Truth Documents
Read and follow in this order (replace/add project-specific docs as needed):
1. docs/INDEX.md (if present)
2. docs/HANDOVER.md or latest handover equivalent
3. docs/ROADMAP.md or build-plan equivalent
4. docs/ARCHITECTURE.md or architecture spec equivalent
5. docs/NON_NEGOTIABLES.md or constraints spec equivalent
6. docs/AGENT_EXECUTION_WORKFLOW_STANDARD.md (if present)
7. docs/PROMPT_AGENT_EXECUTION_WORKFLOW_STANDARD.md (if present)

Rule: If documents conflict, stop and escalate with concrete file references before implementation.

## 3) Non-Negotiables
- Preserve existing behavior unless an explicit fix is requested and test-backed.
- Keep security/auth/tenant/data constraints intact.
- No destructive git operations unless explicitly approved.
- Never revert user changes unless explicitly instructed.
- Preserve unrelated dirty-worktree changes.
- Keep commits coherent and minimal-risk.
- Prefer robust fixes over quick patches.

## 4) Workflow Agreement
1. One step at a time.
2. Ask for explicit `ok` before each next step.
3. Group related micro-steps into coherent checkpoints.
4. Do not open PRs for every tiny edit.
5. At checkpoint boundaries, run full quality gates.
6. Only then commit/push/PR.
7. Keep an explicit audit trail of what was run and what passed.

## 5) Git Hygiene Rules
- Work from feature branches named `codex/<checkpoint-name>`.
- If branch protection blocks direct push to main, use PR workflow.
- Never use destructive commands (`git reset --hard`, `git checkout --`, etc.) unless explicitly requested.
- Do not amend commits unless explicitly asked.

## 6) Testing Policy
- Use targeted tests during iteration.
- Use full gate at each checkpoint boundary:
  - project equivalent of typecheck + lint + test
- If tests cannot run, state exact blocker and required input.

## 7) Required Repo Reality Check (First Action Every Session)
Run and summarize:
- `git status -sb`
- `git branch --show-current`
- `git remote -v`
- `git fetch origin --prune`
- `git log --oneline --decorate -n 20`
- `git log --oneline --decorate origin/main..HEAD` (or default branch equivalent)

Then explicitly report:
- what is committed and local-only
- what is on remote and missing locally
- dirty worktree risk areas
- proposed minimal checkpoint plan

## 8) Checkpoint Plan Format
For each checkpoint:
- Goal:
- Files:
- Risk level:
- Targeted tests:
- Full gate command:
- Commit message:
- PR title/body draft:

## 9) Merge Cleanup Procedure
After merge:
1. `git fetch origin --prune`
2. `git checkout <default-branch>`
3. `git pull --ff-only origin <default-branch>`
4. `git branch -d <feature-branch>`
5. `git status -sb`

## 10) Context Switch Handoff
Before ending context window, record:
- last completed checkpoint
- commit hash(es)
- PR link(s)
- current branch + cleanliness
- exact next single step to execute
