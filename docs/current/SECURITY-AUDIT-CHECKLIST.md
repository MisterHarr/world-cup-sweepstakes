# Security & safety audit checklist

**Purpose:** Executable checklist for a full review before production release and mobile packaging.  
**Related:** `FIREBASE-SURFACE.md`, `ENV-VARS.md`, `HTTP-HEADERS.md`, `ADMIN-TOOLS.md`, `DEPENDENCY-AUDIT-*.md`  
**Output:** Log findings in `SECURITY-FINDINGS-TRACKER.md`.

Use **Pass / Fail / N/A** per row; add notes and tracker IDs for failures.

---

## 1. Authentication & session

| # | Check | ✓ |
|---|--------|---|
| 1.1 | Google OAuth redirect URIs include production domain(s) and any mobile/WebView callback URLs | ☐ |
| 1.2 | Email/password flows match Firebase console settings (enabled providers, password policy) | ☐ |
| 1.3 | Session persistence behaviour is acceptable for shared devices (document if “stay signed in” is required) | ☐ |
| 1.4 | Sign-out clears sensitive UI state where applicable | ☐ |
| 1.5 | No long-lived secrets in client bundle (`NEXT_PUBLIC_*` reviewed in `ENV-VARS.md`) | ☐ |

---

## 2. Authorization & data access

| # | Check | ✓ |
|---|--------|---|
| 2.1 | Firestore rules reviewed for `users`, `teams`, `matches`, `leaderboard`, `settings` — least privilege | ☐ |
| 2.2 | Callable functions enforce auth; admin paths enforce `admin` claim (`FIREBASE-SURFACE.md`) | ☐ |
| 2.3 | Users cannot read/write other users’ private data via client SDK paths | ☐ |
| 2.4 | Admin UI routes documented; server remains source of truth (`ADMIN-TOOLS.md`) | ☐ |
| 2.5 | `getSquadDetails` / leaderboard behaviour for “view other user” matches product policy | ☐ |

---

## 3. Abuse, game integrity & rate limits

| # | Check | ✓ |
|---|--------|---|
| 3.1 | Transfers enforced server-side (window, limits, cost) — not client-only | ☐ |
| 3.2 | Team assignment / confirm flows cannot be replayed to duplicate squads | ☐ |
| 3.3 | Admin seed/mock operations cannot be invoked without admin claim | ☐ |
| 3.4 | Consider rate limiting for sensitive callables if abuse is a concern | ☐ |

---

## 4. Transport, headers & browser security

| # | Check | ✓ |
|---|--------|---|
| 4.1 | App served over HTTPS in production | ☐ |
| 4.2 | `HTTP-HEADERS.md` reviewed; COOP appropriate for OAuth popups | ☐ |
| 4.3 | CSP roadmap: report-only or enforced — documented for hosting layer | ☐ |
| 4.4 | Dependencies: `npm audit` reviewed; critical/high items tracked to closure | ☐ |

---

## 5. Client surface & errors

| # | Check | ✓ |
|---|--------|---|
| 5.1 | Production does not expose stack traces or raw internal errors (`HTTP-HEADERS.md` client note) | ☐ |
| 5.2 | `removeConsole` in production build acknowledged; no reliance on console for security | ☐ |

---

## 6. Privacy & data minimization

| # | Check | ✓ |
|---|--------|---|
| 6.1 | Document what PII is stored (profile, email, scores, department) — privacy notice path | ☐ |
| 6.2 | Analytics/third-party scripts (if any) disclosed and consent if required | ☐ |
| 6.3 | Logs (client/server) do not store passwords or tokens | ☐ |

---

## 7. Compliance & sweepstakes (non-engineering)

| # | Check | ✓ |
|---|--------|---|
| 7.1 | Official rules / eligibility / prize copy reviewed by organiser or legal | ☐ |
| 7.2 | Charity flows (if enabled) match local fundraising regulations | ☐ |
| 7.3 | Age/region restrictions documented if applicable | ☐ |

---

## 8. Operational readiness

| # | Check | ✓ |
|---|--------|---|
| 8.1 | Backup / restore story for Firestore (if required by org) | ☐ |
| 8.2 | Incident contacts and rollback plan for bad deploy | ☐ |
| 8.3 | Emulator or staging environment used for destructive admin tests | ☐ |

---

## Sign-off

| Role | Name | Date | Notes |
|------|------|------|--------|
| Engineering | | | |
| Product / Owner | | | |
| Legal / Compliance (if needed) | | | |

**Release decision:** ☐ Approved ☐ Approved with accepted risks ☐ Not approved  

**Accepted risks (if any):** *(link to rows in `SECURITY-FINDINGS-TRACKER.md`)*
