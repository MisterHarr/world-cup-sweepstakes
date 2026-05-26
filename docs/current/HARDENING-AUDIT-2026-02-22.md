# Hardening Audit (Non-Negotiables)

**Date:** 2026-02-22  
**Scope:** Production readiness against documented non-negotiables

## Current Status Snapshot

- Builds:
  - `npm run build` (root): pass
  - `cd functions && npm run build`: pass
- Emulator regression:
  - `npm run test:badges`: pass
- Baseline guardrails already in place:
  - Admin auth checks on privileged callables
  - Manual/controlled fixture ingest via admin tools
  - Transfer execution authz + window enforcement

## Findings (Ordered by Severity)

| Priority | Area | Finding | Risk | Recommended Hardening |
|---|---|---|---|---|
| P1 | Badges domain logic | Badge unlock engine is not implemented in backend triggers; current system only reads existing badge fields for display/count. | Badges can appear incomplete/inaccurate, low trust in gamification. | Implement `badgeEngine` trigger path for recompute, transfer, and engagement events; write `badgeEvents` audit log. |
| P1 | Tournament replay realism | Local 2022 fixture dataset currently contains 12 group-stage matches only (`GROUP`, up to 2022-11-23). | Cannot rehearse knockout behavior or full-tournament progression. | Import full 2022 fixture set and extend staged waves beyond `G1/G2/G3` to knockout stages. |
| P1 | Badge contract consistency | Multiple badge schemas exist (`earnedBadges`, `badges[]`, `badges{}`), historically with inconsistent unlock semantics. | Count/UI mismatches and fragile future migrations. | Define and migrate to one canonical schema (`users/{uid}.badges` map with explicit unlocked metadata). |
| P2 | Automated coverage depth | No browser E2E test currently validates `/badges` UX state transitions on real viewport breakpoints. | UI regressions can ship undetected. | Add Playwright badge smoke suite for locked/unlocked rendering + rarity filters + mobile layout. |
| P2 | Operations observability | Runbook includes monitoring guidance, but badge-specific telemetry and alert thresholds are not wired. | Slow incident detection for badge awarding failures. | Add structured badge logs + Cloud Monitoring alerts for badge write failures and recompute anomalies. |
| P2 | Compliance readiness (payments) | No payment or compliance subsystem exists yet for charity contributions. | Legal/compliance risk if launched without governance. | Gate launch on legal entity model, terms, consent text, and processor compliance checklist. |

## Non-Negotiable Alignment Check

- Git workflow and commit hygiene: in use (small scoped commits, build-before-commit).
- Build gate before merge: in use.
- Auth checks on admin writes: in place.
- Token optimization and doc control plane: in use.

## Recommended Next Hardening Sprint

1. Badge engine implementation + canonical schema migration.
2. Full 2022 fixtures ingest (group + knockout waves) for realistic rehearsal.
3. Badge E2E UI suite and alerting instrumentation.

