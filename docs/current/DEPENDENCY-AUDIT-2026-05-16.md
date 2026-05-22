# Dependency audit (Sprint 8)

**Date:** 2026-05-16  
**Commands:**  
- `npm audit --omit=dev`  
- `cd functions && npm audit --omit=dev`

## Root app summary

- Root app build: **passed**
- `next`: upgraded from `16.1.6` to `16.2.6`
- `firebase`: upgraded from `12.7.0` to `12.13.0`
- Remaining audit result: **2 moderate vulnerabilities**

Current root audit findings:

- `postcss <8.5.10` via `next`
- No remaining root **high** or **critical** advisories after the upgrade pass

## Functions summary

- Functions build: **passed**
- `firebase-admin`: upgraded from `13.6.0` to `13.10.0`
- `firebase-functions`: upgraded from `7.0.2` to `7.2.5`
- Added targeted overrides in [`functions/package.json`](/Users/harrison.j/world-cup-sweepstakes-clean/functions/package.json):
  - `protobufjs: 7.5.8`
  - `path-to-regexp: 0.1.13`
- Remaining audit result: **9 low vulnerabilities**

Current Functions findings:

- No remaining Functions **critical**, **high**, or **moderate** advisories in `npm audit --omit=dev --json`
- Remaining low-only findings are tied to the Firebase Admin optional Firestore/Storage tree:
  - `@tootallnate/once <3.0.1`
  - `@google-cloud/firestore`
  - `@google-cloud/storage`
  - `google-gax`
  - `retry-request`
  - `teeny-request`

## Release implication

Sprint 8 improved the dependency posture materially, but the project is still **not go/no-go clean**:

- Root app dependency risk is down to **moderate-only**.
- Functions dependency risk is down to **low-only**.

That means the release gate remains **blocked** until the Functions-side findings are either:

1. the root moderate Next/PostCSS-linked finding is fixed upstream or explicitly accepted, and
2. the remaining low-only Firebase Admin transitive findings are either monitored or explicitly accepted.

## Related files

- [`docs/current/SECURITY-FINDINGS-TRACKER.md`](/Users/harrison.j/world-cup-sweepstakes-clean/docs/current/SECURITY-FINDINGS-TRACKER.md)
- [`docs/current/PRODUCTION-GO-NO-GO-CHECKLIST.md`](/Users/harrison.j/world-cup-sweepstakes-clean/docs/current/PRODUCTION-GO-NO-GO-CHECKLIST.md)
