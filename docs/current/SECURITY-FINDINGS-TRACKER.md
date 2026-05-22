# Security findings & remediation tracker

**Purpose:** Single place to record audit findings, owners, and verification.  
**How to use:** Add a row per finding; update status until **Closed**. Link PRs or commits in **Evidence**.

---

## Status legend

- **Open** — not started  
- **In progress** — fix underway  
- **Ready for verify** — fix merged, needs re-test  
- **Closed** — verified in target environment  
- **Accepted risk** — documented exception (requires sign-off in checklist)

---

## Severity legend

- **Critical** — exploitable or data breach risk; block release  
- **High** — significant misuse or integrity risk; fix before release unless accepted  
- **Medium** — should fix in release window  
- **Low** — hygiene, hardening backlog  

---

## Findings

| ID | Date | Area | Severity | Summary | Owner | Status | Target date | Evidence / notes |
|----|------|------|----------|---------|-------|--------|-------------|------------------|
| RH-001 | 2026-05-16 | Root app dependencies | Medium | `next@16.2.6` still triggers the `postcss <8.5.10` advisory path, leaving 2 moderate root audit findings. | Engineering | In progress | Before release candidate | See [`docs/current/DEPENDENCY-AUDIT-2026-05-16.md`](/Users/harrison.j/world-cup-sweepstakes-clean/docs/current/DEPENDENCY-AUDIT-2026-05-16.md). No remaining root high/critical findings after Sprint 8 upgrades. |
| RH-002 | 2026-05-16 | Functions dependencies | Critical | `protobufjs <=7.5.5` remained in the Functions dependency tree before targeted overrides. | Engineering | Closed | 2026-05-16 | Closed by the `protobufjs: 7.5.8` override in [`functions/package.json`](/Users/harrison.j/world-cup-sweepstakes-clean/functions/package.json); final audit JSON shows no remaining critical findings. |
| RH-003 | 2026-05-16 | Functions dependencies | High | `path-to-regexp <0.1.13` remained via `firebase-functions` / Express transitive tree before targeted overrides. | Engineering | Closed | 2026-05-16 | Closed by the `path-to-regexp: 0.1.13` override in [`functions/package.json`](/Users/harrison.j/world-cup-sweepstakes-clean/functions/package.json); final audit JSON shows no remaining high findings. |
| RH-004 | 2026-05-16 | Functions dependencies | Low | `@tootallnate/once <3.0.1` remains in the Firebase Admin optional storage/request chain. | Engineering | Open | Before release candidate | No longer release-blocking on severity, but should be monitored or explicitly accepted. See [`docs/current/DEPENDENCY-AUDIT-2026-05-16.md`](/Users/harrison.j/world-cup-sweepstakes-clean/docs/current/DEPENDENCY-AUDIT-2026-05-16.md). |

---

## Remediation sprint (template)

**Sprint goal:** Close all Critical/High items before store submission or production cutover.

| Finding ID | Verification steps | Verified by | Date |
|------------|--------------------|-------------|------|
| RH-001 | Re-run root `npm audit --omit=dev` after next/Firebase upgrades. Confirm no root High/Critical remain. | Codex | 2026-05-16 |
| RH-002 | Re-run `cd functions && npm audit --omit=dev --json` after targeted overrides. Confirm `protobufjs` no longer appears as Critical. | Codex | 2026-05-16 |
| RH-003 | Re-run `cd functions && npm audit --omit=dev --json` after targeted overrides. Confirm `path-to-regexp` no longer appears as High. | Codex | 2026-05-16 |
| RH-004 | Re-run `cd functions && npm audit --omit=dev` and confirm `@tootallnate/once` is resolved or explicitly accepted. |  |  |

---

## Accepted risks (template)

Use only with written sign-off.

| ID | Summary | Business rationale | Reviewer | Date | Expiry (if any) |
|----|---------|-------------------|----------|------|-----------------|
| | | | | | |
