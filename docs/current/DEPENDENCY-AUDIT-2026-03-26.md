# Dependency audit (C5)

**Date:** 2026-03-26  
**Command:** `npm audit --omit=dev`

## Result summary

- Total vulnerabilities: **1**
- Severity: **moderate**
- Package: **`next`**
- Installed range affected: `16.0.0-beta.0 - 16.1.6`
- Current project version: `16.1.6`
- Suggested fix from npm: upgrade to **`next@16.2.1`**

Advisories reported:

- [GHSA-ggv3-7p47-pfv8](https://github.com/advisories/GHSA-ggv3-7p47-pfv8) - HTTP request smuggling in rewrites
- [GHSA-3x4c-7xq6-9pq8](https://github.com/advisories/GHSA-3x4c-7xq6-9pq8) - Unbounded `next/image` disk cache growth
- [GHSA-h27x-g6w4-24gq](https://github.com/advisories/GHSA-h27x-g6w4-24gq) - Unbounded postponed resume buffering DoS
- [GHSA-mq59-m269-xvcx](https://github.com/advisories/GHSA-mq59-m269-xvcx) - null origin bypass for Server Actions CSRF checks
- [GHSA-jcc7-9wpm-mj36](https://github.com/advisories/GHSA-jcc7-9wpm-mj36) - null origin bypass for dev HMR websocket CSRF checks

## Policy

1. Run `npm audit --omit=dev` before each release candidate.
2. For framework-level advisories (`next`, `react`, `firebase`), prioritize patch/minor upgrades in the next sprint.
3. Record accepted risk only when an upgrade has clear regression risk and a rollback plan is documented.

## Planned follow-up

- Create a dedicated upgrade bundle to move `next` from `16.1.6` to `16.2.1`.
- Re-run:
  - `npm run build`
  - primary UX smoke flow (`/`, `/dashboard`, `/leaderboard`, `/admin/*`)
  - `npm audit --omit=dev` to confirm closure.
