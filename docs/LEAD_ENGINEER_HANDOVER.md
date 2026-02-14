# Lead Engineer Handover

Last updated: 2026-02-14

## 1) Scope and Intent

This handover is the operational and engineering source of truth for the next lead engineer taking over `world-cup-sweepstakes`.

Primary goals:

- Keep live operations cost-safe (near-zero outside explicit windows).
- Preserve current security and data guardrails.
- Continue checkpointed delivery with strict git hygiene and auditable tests.

## 2) Critical Repo Reality

- **Authoritative git repo:** `/Users/harrison.j/world-cup-sweepstakes-clean`
- **Non-authoritative runtime copy:** `/Users/harrison.j/world-cup-sweepstakes` (currently not a git repo)

Rule:

- Do all commits, branches, PRs, and quality gates in `world-cup-sweepstakes-clean`.
- If app runs from the non-git folder, treat that as a local execution convenience only, not source of truth.

## 3) Current Delivery State

What is complete:

- Auth + admin claims + Firestore rules guardrails.
- Admin fixture tools (`/admin/fixtures`) and scheduler safety switch.
- Provider ingest path and controlled provider smoke sign-off.
- Ingest health telemetry + health state presentation in admin UI.
- External alerting setup completed and verified:
  - Alert policy: `projects/worldcup-sweepstake-2026/alertPolicies/8460958675161850743`
  - Notification channel: `projects/worldcup-sweepstake-2026/notificationChannels/5604417890488344253`
  - Synthetic incident evidence: `2026-02-13T08:51:32Z`
- Transfer flow and guardrails verified (valid transfer succeeds, invalid repeat blocked).
- Transfer window reset to safe default (`enabled: false`) after testing.
- Scheduler currently held in cost-safe state (`DISABLED` in admin tools).

## 4) Latest Completed Checkpoint and Current Priority

Transfer CTA contrast checkpoint is completed and merged.

Merged checkpoint evidence:

- Commit: `66a3825` (`fix(ui): improve transfer CTA contrast in transfer window active state`)
- PR: `https://github.com/MisterHarr/world-cup-sweepstakes/pull/1`
- Merge commit on `main`: `1eeed54`

Follow-on docs checkpoint is also completed:

- Commit on `main`: `f9fa4c2` (`docs(ops): record CTA checkpoint merge and next-step rollover`)

Expanded participant set rerun checkpoint is completed:

- Commit: `750f71f` (`docs(ops): record 5-user pre-tournament rerun evidence`)
- PR: `https://github.com/MisterHarr/world-cup-sweepstakes/pull/2`
- Evidence: `docs/REHEARSAL-LOG.md` (section: "Pre-Tournament Operational Sign-Off 2026-02-13 (Expanded Participant Set)")

Auth UX checkpoint completed and merged:

- Commit: `9ed534d` (`fix(auth): restore login UI and redirect on sign-out`)
- PR: `https://github.com/MisterHarr/world-cup-sweepstakes/pull/4`
- Invariants: `/login` shows v0 landing UI, sign-out redirects to `/login`

Current open build item (Priority 1):

- **Production readiness sprint plan** now defined in `docs/PRODUCTION-READINESS-ROADMAP.md`.
- **Next sprint:** Sprint 1 - Accessibility & WCAG 2.1 AA Compliance (P0, blocks launch).
- Use `docs/PRODUCTION-READINESS-ROADMAP.md` as scope and acceptance authority.

## 5) Mandatory Workflow Routine

The project uses strict collaboration flow:

1. Propose the **next best single step**.
2. Briefly state **what/why**.
3. Wait for explicit user `ok`.
4. Execute only that step.
5. Report results and evidence.
6. Repeat.

Additional routine constraints:

- If user asks a clarifying question with `ok`, do not silently change direction.
- No destructive git operations unless explicitly requested.
- Preserve unrelated local changes.

## 6) Required GitHub Commit Flow

Use this sequence for every checkpoint:

1. `git checkout main`
2. `git fetch origin --prune`
3. `git pull --ff-only origin main`
4. `git checkout -b codex/<checkpoint-name>`
5. Make scoped changes.
6. Run gates:
   - `npm run lint`
   - `npm run build`
   - `(cd functions && npm run build)`
   - `npm run test:rehearsal`
7. `git add <scoped-files>`
8. `git commit -m "<type(scope): message>"`
9. `git push -u origin codex/<checkpoint-name>`
10. Open PR to `main` with:
   - summary
   - test evidence
   - risk notes
11. Merge only after gate pass and review.

After merge cleanup:

1. `git checkout main`
2. `git pull --ff-only origin main`
3. `git branch -d codex/<checkpoint-name>`
4. `git fetch origin --prune`

## 7) Test/Gate Policy

- Targeted test while iterating is acceptable.
- Full gate required at checkpoint boundaries.
- Known baseline:
  - In `world-cup-sweepstakes-clean`: lint currently passes with warnings (no errors).
  - In `world-cup-sweepstakes` non-git copy: lint has many legacy errors and is non-authoritative.

## 8) Production Ops Guardrails

- Keep live scheduler disabled except explicit controlled windows.
- If incident occurs:
  - disable automation first,
  - run manual fallback (`Run Fixture Ingest` + `Recompute Leaderboard`),
  - validate board/live UI.
- Keep runbook as execution authority:
  - `docs/TOURNAMENT-RUNBOOK.md`

## 9) First 10 Actions for New Lead Engineer

1. Move to authoritative repo: `/Users/harrison.j/world-cup-sweepstakes-clean`.
2. Run repo reality check:
   - `git status -sb`
   - `git branch --show-current`
   - `git remote -v`
   - `git fetch origin --prune`
   - `git log --oneline --decorate -n 20`
3. Confirm `main` includes latest merged checkpoints (`a882ea3`, `1eeed54`, `f9fa4c2`) and no local-only commits.
4. Confirm ops defaults remain cost-safe before next rehearsal window (`scheduler DISABLED`, `transferWindow disabled`).
5. Read `docs/BUILD-STATUS-NEXT-STEPS.md` and lock the current Priority 1 scope.
6. Create branch `codex/<next-checkpoint-name>` for the open item.
7. Run targeted checks during iteration, then full gates:
   - `npm run lint`
   - `npm run build`
   - `(cd functions && npm run build)`
   - `npm run test:rehearsal`
8. Commit and push the scoped checkpoint; open PR to `main` with summary, test evidence, and risk notes.
9. Merge only after review + gate pass; run post-merge cleanup.
10. Update handover docs with commit hash(es), PR link(s), and exact next single step.

## 10) Required Read Order on Context Start

1. `docs/COMMIT_EXECUTION_HANDOVER.md`
2. `docs/LEAD_ENGINEER_HANDOVER.md`
3. `docs/INDEX.md`
4. `docs/PRODUCTION-READINESS-ROADMAP.md` ⭐ (replaces BUILD-STATUS-NEXT-STEPS.md)
5. `docs/TOURNAMENT-RUNBOOK.md`
6. `docs/REHEARSAL-LOG.md`

If any conflict is found between these docs, stop and escalate with file references before implementation.

**Note:** `BUILD-STATUS-NEXT-STEPS.md` was archived to `archive/docs-legacy/BUILD-STATUS-NEXT-STEPS-2026-02-13.md` on 2026-02-14.
