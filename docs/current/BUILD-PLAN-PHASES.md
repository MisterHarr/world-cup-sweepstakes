# Final improvement build plan — phased micro-steps

**Created:** 2026-03-26  
**Purpose:** Executable breakdown of the lead-engineering plan (stabilization → security readiness → mobile packaging).  
**Process:** Complete work in **bundles of two micro-steps**; after each bundle: local verify, then proceed to the next pair.

**Related:** `UI-UX-SPRINT-BUILD-PLAN.md`, `BUILD-STATUS-NEXT-STEPS.md`, `HARDENING-AUDIT-2026-02-22.md`

---

## Phase A — Stabilization & release hygiene

| ID | Micro-step | Done |
|----|------------|------|
| A1 | Replace root `app/layout.tsx` metadata: `title`, `description`, `metadataBase` (from `NEXT_PUBLIC_APP_URL` when set), optional `openGraph`/`twitter` using `lib/branding` | ✅ |
| A2 | Single auth entry: **permanent redirect** `/login` → `/` (or `/` → `/login` — **standard: `/login` → `/`**) in `next.config.ts` | ✅ |
| A3 | Remove implementation-only copy: e.g. dashboard `LeaderboardPanel` `modeLabel` — use sensible default or meaningful `sr-only` text only | ✅ |
| A4 | Align `app/error.tsx` with app design tokens (`bg-background`, `border-border`, `text-foreground`, `Button` variants) — no orphan slate palette | ✅ |
| A5 | Dashboard root `Suspense` fallback: match skeleton/loader pattern (reuse `LoadingSpinner` / `TabPanelLoading` style) | ✅ |
| A6 | Run `pnpm build`; fix any regressions from A1–A5 | ✅ |

**Exit:** ✅ Phase A complete — no placeholder “Create Next App” strings; one canonical login URL; build green.

---

## Phase B — UX / engineering debt (navigation, a11y, DRY)

| ID | Micro-step | Done |
|----|------------|------|
| B1 | **Dashboard wayfinding:** ~~visible tab strip~~ **revised:** single nav — `?tab=` + floating `AppShellV0` only (no duplicate header nav) | ✅ |
| B2 | **Shell convergence:** shared header/nav primitives; reduce drift between `AppShell` and `AppShellV0` (document target architecture first if needed) | ✅ |
| B3 | **Auth a11y:** `AuthLandingPage` — visible `<Label>` + `htmlFor` / ids for email, password, optional name | ✅ |
| B4 | Extract **TierPill** + tier styles to `components/` (single module); update `DashboardPortfolio` + `LeaderboardPanel` imports | ✅ |
| B5 | **Terminology pass:** align UI strings with guide (e.g. Star Team vs featured) — single glossary source of truth in copy | ✅ |
| B6 | `pnpm build` + smoke: auth, dashboard tabs, leaderboard | ✅ |

**Exit:** ✅ Phase B complete — keyboard/label basics on auth; tier UI single-source; guide-aligned terminology on key surfaces.

---

## Phase C — Pre–security-audit engineering checklist

| ID | Micro-step | Done |
|----|------------|------|
| C1 | **Env template:** `.env.example` (or `docs/current/ENV-VARS.md`) listing all `NEXT_PUBLIC_*` and server-only vars; no secrets committed | ✅ |
| C2 | **Firebase surface doc:** pointer to Firestore rules file, list of `onCall` functions + auth requirements (`requireAuth` / `requireAdmin`) | ✅ |
| C3 | Review **client error surfaces** — user-visible messages sanitized; no stack traces in production UI | ✅ |
| C4 | **HTTP headers:** document current `next.config.ts` headers; optional CSP roadmap (report-only first) | ✅ |
| C5 | **Dependencies:** `npm audit` / lockfile policy; document in same env/hardening note | ✅ |
| C6 | **Admin routes:** confirm gating + no accidental public entry points; document | ✅ |

**Exit:** ✅ Phase C complete — auditor can trace config → functions → rules, with dependency/admin-route notes documented.

---

## Phase D — Security & safety audits (process, not code)

| ID | Micro-step | Done |
|----|------------|------|
| D1 | Run agreed audit checklist (auth, authz, abuse, privacy, compliance handoff to legal) | ✅ |
| D2 | Track findings; remediate in a dedicated sprint before store submission | ✅ |

**Exit:** Checklist + tracker templates ready — run audit and sign off using `SECURITY-AUDIT-CHECKLIST.md` + `SECURITY-FINDINGS-TRACKER.md`.

---

## Phase E — Downloadable mobile app readiness

| ID | Micro-step | Done |
|----|------------|------|
| E1 | **Decision record:** Capacitor (WebView → HTTPS) vs PWA/TWA — one paragraph in this doc or `docs/current/MOBILE-PACKAGING.md` | ✅ |
| E2 | **Web app shell:** `manifest.webmanifest`, icons (reuse `public/branding` where possible), `theme-color` aligned with CSS | ✅ |
| E3 | **Safe areas:** audit fixed UI (`app-shell-v0`, headers) for `env(safe-area-inset-*)` with `viewportFit: cover` | ✅ |
| E4 | **OAuth / redirects:** document production domain + mobile callback URLs for Firebase/Google console | ✅ |
| E5 | **Touch targets:** nav/buttons ≥ 44px where feasible; quick pass on smallest breakpoint | ✅ |
| E6 | Wrapper project (if Capacitor): init, load origin, test auth round-trip on device | ✅ |

**Exit:** ✅ PWA manifest + safe areas + OAuth docs + touch targets; Capacitor intentionally **not** in-repo (see `MOBILE-PACKAGING.md`). **Still validate:** install from browser on a real device and run Google sign-in on production HTTPS before release.

---

## Phase F — Optional post-MVP

| ID | Micro-step | Done |
|----|------------|------|
| F1 | Push notifications (only if product requires) — spec + Firebase setup | ☐ |
| F2 | E2E smoke tests (e.g. Playwright): login → featured team → reveal → dashboard | ☐ |
| F3 | i18n only if scope expands | ☐ |

---

## Execution order (strict)

1. Complete **Phase A** micro-steps in order (may span multiple two-step bundles).  
2. Then **Phase B**, then **C**, then **D** (your audits), remediate, then **E**, then **F** as needed.  
3. After each **two-step bundle**: implement → `pnpm build` where applicable → manual QA per bundle notes.

---

## Status log

| Date | Bundle | Notes |
|------|--------|-------|
| 2026-03-26 | A1 + A2 | Root metadata from `BRANDING` + `metadataBase`; `/login` → `/` permanent redirect |
| 2026-03-26 | A3 + A4 | Dashboard drops `modeLabel`; default Leaderboard `sr-only` "Leaderboard"; `app/error.tsx` tokens + `AlertTriangle` |
| 2026-03-26 | A5 + A6 | `DashboardSuspenseFallback` (header + `TabPanelLoading` skeletons); `npm run build` verified; Phase A closed |
| 2026-03-26 | B1 + B2 | Dashboard tab strip + `goToTab` URL sync; `AppBrandBlock` + `SHELL-CONVERGENCE.md` |
| 2026-03-26 | B3 + B4 | `AuthLandingPage` labels + ids; `components/tier/TierPill.tsx` shared |
| 2026-03-26 | B5 + B6 | Terminology: Star Team / Drawn Teams / squad; `npm run build`; smoke: `/` quick help, dashboard squad, leaderboard drawer |
| 2026-03-26 | C1 + C2 | `/.env.example` + `docs/current/ENV-VARS.md`; `docs/current/FIREBASE-SURFACE.md` |
| 2026-03-26 | C3 + C4 | Dashboard `friendlyErrorMessage` + production-safe fallbacks; `ErrorBoundary` tokens; `docs/current/HTTP-HEADERS.md` |
| 2026-03-26 | C5 + C6 | `npm audit --omit=dev` logged in `DEPENDENCY-AUDIT-2026-03-26.md`; admin route gating matrix + `/admin/runbook` gate |
| 2026-03-26 | D1 + D2 | `SECURITY-AUDIT-CHECKLIST.md` + `SECURITY-FINDINGS-TRACKER.md` |
| 2026-03-26 | E1 + E2 | `MOBILE-PACKAGING.md`; `app/manifest.ts` + `themeColorHex` / viewport `themeColor`; SVG icon from `public/branding` |
| 2026-03-27 | E3 + E4 | `SAFE-AREAS.md` + safe-area `calc()` on `AppShell`, `AppShellV0`, guide header, leaderboard drawer, reveal CTA; `OAUTH-REDIRECTS.md` + `FIREBASE-SURFACE` link |
| 2026-03-27 | E5 + E6 | `AppShellV0` / `AppShell` / `AuthLandingPage` ≥44px targets; `MOBILE-PACKAGING.md` Capacitor deferral + checklist (no `capacitor.config` in repo) |
