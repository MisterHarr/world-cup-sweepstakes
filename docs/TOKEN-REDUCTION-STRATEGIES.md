# Token Reduction Strategies

**Purpose**: Maximize effective work per conversation by minimizing token waste on verbose output while maintaining quality gates and safety.

---

## Core Principles

1. **Output Compression**: Capture full data to files, show summaries in conversation
2. **Progressive Detail**: Start minimal, expand only on failure/request
3. **Batch Operations**: Group related micro-steps to reduce approval overhead
4. **Smart Defaults**: Use compact formats unless high-risk surfaces require detail

---

## Standard Practices

### 1. Noisy Command Output
**Problem**: Build/test commands can generate thousands of lines of output, burning tokens unnecessarily.

**Solution**: Redirect verbose output to files, show summaries only.

```bash
# ❌ BAD - Burns ~2000 tokens
npm run build

# ✅ GOOD - Burns ~50 tokens
npm run build > /tmp/build.log 2>&1 && echo "✅ Build passed" || (echo "❌ Build failed. Last 20 lines:" && tail -20 /tmp/build.log)
```

**Standard commands**:
- `npm run build` → redirect to log, show last 20 lines on failure
- `npm run lint` → redirect to log, show error count + first 5 errors on failure
- `npm test` → redirect to log, show pass/fail summary only
- `git log` → use `--oneline` or `--stat` by default

### 2. Focused Tests First
**Problem**: Running full test suites for every micro-change wastes tokens.

**Solution**: Progressive testing pyramid.

```
Micro-step level:
  - Type check only (tsc --noEmit)
  - Lint only affected files
  - Run unit tests for changed modules

Checkpoint level (before commit):
  - Full lint
  - Full build
  - Full test suite
  - Integration tests

PR level:
  - All quality gates
  - CI/CD validation
```

**Example flow**:
1. Change `app/dashboard/page.tsx` → run `eslint app/dashboard/page.tsx` only
2. Three micro-steps complete → run full `npm run lint && npm run build`
3. Ready to commit → run `npm run test:rehearsal`

### 3. Diff Hygiene
**Problem**: Full diffs of large files burn thousands of tokens when only metadata is needed.

**Solution**: Default to compact formats, expand strategically.

```bash
# ❌ BAD - Shows every changed line (500+ tokens)
git diff

# ✅ GOOD - Shows what changed at file level (~50 tokens)
git status -sb
git diff --stat

# ✅ EXPAND ONLY WHEN NEEDED
git diff app/dashboard/page.tsx  # Show full diff for specific file
git diff --cached               # Show staged changes before commit
```

**When to show full diffs**:
- Security-sensitive files (auth, permissions, Firestore rules)
- Before committing (final review)
- User explicitly requests
- Debugging unexpected behavior

### 4. Tool Output Caps
**Problem**: Some tools are inherently verbose (npm install, Firebase deploys).

**Solution**: Use `head`/`tail` to limit output, re-run with full output only for diagnosis.

```bash
# ❌ BAD - 1000+ lines of dependency resolution
npm install

# ✅ GOOD - Show start and end only
npm install 2>&1 | (head -5; echo "... (installation in progress) ..."; tail -10)

# ❌ BAD - Every file in deployment
firebase deploy

# ✅ GOOD - Summary only
firebase deploy 2>&1 | grep -E "(Preparing|Uploading|Deploy complete|Error)"
```

**Standard limits**:
- Package managers: First 5 + last 10 lines
- File operations: `--stat` or count only
- Database migrations: Success/failure + error details only
- Deployments: Progress markers + final status

### 5. PR Metadata Always Included
**Problem**: Creating PRs via `gh pr create` produces a URL but requires separate message for title/body.

**Solution**: Always include paste-ready PR metadata in the same response.

```
✅ STANDARD FORMAT:

**PR #X: [Title]**
- Branch: `feature/branch-name`
- URL: https://github.com/user/repo/pull/X

## Summary
[2-3 sentences describing what changed and why]

## Changes
- File 1: Description of change
- File 2: Description of change

## Quality Gates
✅ lint
✅ build
✅ functions build
✅ test:rehearsal

## Related
- Closes #issue-number (if applicable)
- Part of Sprint X (if applicable)
```

### 6. Batch Approvals
**Problem**: Sequential approvals for related micro-steps cause excessive back-and-forth.

**Solution**: Present numbered micro-step queues, allow batch approval.

```
✅ STANDARD FORMAT:

I'll implement Feature X in 4 micro-steps:

1. Add TypeScript interface for new type (app/types.ts)
2. Create UI component with interface (components/NewFeature.tsx)
3. Integrate component into page (app/page.tsx)
4. Add unit tests (components/__tests__/NewFeature.test.tsx)

**User can respond**:
- `ok` → approve all 4, proceed sequentially
- `ok 1-3` → approve first 3, skip tests for now
- `ok 2,4` → approve 2 and 4, skip 1 and 3
- `no 3, rest ok` → skip 3, do others
```

### 7. Read Operations
**Problem**: Reading entire files when only checking for existence or structure.

**Solution**: Use targeted reads with offset/limit.

```bash
# ❌ BAD - Read entire 500-line file to check imports
Read("app/dashboard/page.tsx")

# ✅ GOOD - Read first 20 lines only
Read("app/dashboard/page.tsx", limit=20)

# ❌ BAD - Read entire file to find one function
Read("lib/utils.ts")

# ✅ GOOD - Grep for function signature first
Grep(pattern="function getUserData", path="lib/utils.ts", output_mode="files_with_matches")
```

**When to read full files**:
- Files under 100 lines
- About to edit (Edit tool requires prior Read)
- Debugging logic errors
- User explicitly requests

### 8. Glob/Grep Before Read
**Problem**: Reading multiple files to find something that Grep can locate.

**Solution**: Search first, read only matches.

```bash
# ❌ BAD - Read 10 files to find API route
Read("app/api/**/route.ts") × 10

# ✅ GOOD - Grep first, read matches
Grep(pattern="export async function POST", glob="app/api/**/route.ts", output_mode="files_with_matches")
# Returns: ["app/api/users/route.ts"]
Read("app/api/users/route.ts")
```

### 9. Git Operations
**Problem**: `git log`, `git diff`, `git show` can be extremely verbose.

**Solution**: Use compact formats by default.

```bash
# ❌ BAD - Full commit history (1000+ lines)
git log

# ✅ GOOD - One line per commit
git log --oneline -10

# ❌ BAD - Full diff for last commit
git show

# ✅ GOOD - Files changed with stats
git show --stat

# ❌ BAD - All commits in branch
git log main..feature

# ✅ GOOD - Count + first/last only
git log --oneline main..feature | (echo "Total: $(wc -l)"; head -5; echo "..."; tail -5)
```

### 10. Error-First Reporting
**Problem**: Showing successful output when failures are what matter.

**Solution**: Exit early on success, verbose only on failure.

```bash
# ❌ BAD - Always shows full output
npm run lint
npm run build
npm run test

# ✅ GOOD - Silent success, verbose failure
npm run lint > /tmp/lint.log 2>&1 && echo "✅ Lint passed" || (echo "❌ Lint failed:" && cat /tmp/lint.log)
npm run build > /tmp/build.log 2>&1 && echo "✅ Build passed" || (echo "❌ Build failed:" && tail -30 /tmp/build.log)
```

---

## Token Budget Guidelines

### Micro-step (Single logical change)
- **Target**: 500-1500 tokens
- **Quality gates**: Type check or targeted lint only
- **Output**: Compact formats only
- **Example**: Change button color, update one function

### Checkpoint (Group of related micro-steps)
- **Target**: 2000-5000 tokens
- **Quality gates**: Full lint + build
- **Output**: Summary + error details on failure
- **Example**: Complete one slice (3-5 micro-steps)

### Commit/PR (Shippable unit)
- **Target**: 3000-8000 tokens
- **Quality gates**: All gates (lint, build, functions, tests)
- **Output**: Full PR metadata + quality gate results
- **Example**: Complete feature slice ready for review

### Sprint Completion
- **Target**: 10000-20000 tokens
- **Quality gates**: All gates + integration tests + manual verification
- **Output**: Comprehensive summary + test results + deployment readiness
- **Example**: Complete Sprint 1 (5 slices, 5 PRs)

---

## Enforcement Checklist

Before executing any command, ask:

- [ ] **Can I redirect to a file?** (builds, installs, deploys)
- [ ] **Can I use --stat instead?** (git diff, npm list)
- [ ] **Can I limit output?** (head, tail, grep)
- [ ] **Do I need the full file?** (use offset/limit on Read)
- [ ] **Can I search first?** (Grep before Read)
- [ ] **Is this a micro-step or checkpoint?** (adjust quality gates)
- [ ] **Can I batch this with others?** (present queue for approval)

---

## Exception Cases

**Always show full output for**:
1. **Security surfaces**: Firestore rules, auth code, permission checks
2. **User requests**: "Show me the full diff", "What does the test output say?"
3. **Commit reviews**: Final pre-commit diff check
4. **Debugging**: When investigating unexpected behavior
5. **High-risk changes**: Database migrations, breaking API changes

**Never compress**:
1. Final commit messages (need full context)
2. PR descriptions (need comprehensive summary)
3. Security audit results
4. User-facing error messages

---

## Measuring Success

**Good conversation** (following strategies):
- 40-60k tokens for complete sprint (5 slices)
- ~8k tokens per slice (including quality gates)
- ~2k tokens per micro-step
- Minimal back-and-forth for routine approvals

**Wasteful conversation** (ignoring strategies):
- 100k+ tokens for same sprint
- ~20k tokens per slice
- ~5k tokens per micro-step
- Excessive approvals for trivial steps

**Target efficiency**: 2-3× more work per conversation by following these strategies.

---

## Quick Reference Card

```bash
# Git
git status -sb                    # Not: git status
git diff --stat                   # Not: git diff
git log --oneline -10             # Not: git log

# Build/Test
cmd > /tmp/out.log 2>&1 && echo ✅ || (echo ❌ && tail -20 /tmp/out.log)

# Read Operations
Read(file, limit=20)              # Not: Read(file) for large files
Grep first, Read matches          # Not: Read multiple files

# Quality Gates
Micro-step: type check only
Checkpoint: lint + build
PR: all gates

# PR Creation
Always include: title, summary, changes, quality gates, related issues

# Batch Approvals
Present: numbered list → User: "ok 1-4" or "ok 2,4"
```

---

**Last Updated**: 2026-02-14
**Owner**: Engineering Team
**Review Cycle**: After each sprint retrospective
