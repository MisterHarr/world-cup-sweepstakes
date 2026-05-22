# Mobile packaging decision

**Decision (2026-03-26):** Ship the web app as a **Progressive Web App (PWA)** first—`manifest` + installability from the browser—so OAuth, Firebase, and HTTPS behave like production with minimal wrapper code. **Trusted Web Activity (TWA)** on Android is the natural store path if a Play listing is required while still loading the same site. **Capacitor** remains optional for a later phase if native shell features (push, deep links beyond universal links, or stricter offline) justify maintaining a separate wrapper; it would still load the deployed HTTPS origin in a WebView with the same auth and redirect constraints documented in `FIREBASE-SURFACE.md` and **`OAUTH-REDIRECTS.md`**.

**Safe areas:** See `SAFE-AREAS.md` (notch / home indicator padding for shell UI).

## Capacitor — deferred

No Capacitor project lives in this repo yet. **Defer** `npx cap init` until a native shell is required (push, store packaging that cannot use TWA, or WebView-specific fixes). When you add it:

1. Create the wrapper in a **separate directory** or branch first; point `server.url` at your deployed HTTPS origin (or dev) per Capacitor docs.
2. Re-read **`OAUTH-REDIRECTS.md`** — the WebView origin must be added to Google OAuth **JavaScript origins**; retest Firebase Google sign-in (redirect + popup behaviour may differ).
3. Run auth on a **physical device**; confirm safe-area insets still match `SAFE-AREAS.md` (or add a native status-bar plugin if needed).

**Exit:** No `capacitor.config.*` in-repo until this checklist is executed.
