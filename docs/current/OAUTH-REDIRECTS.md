# OAuth & redirect configuration

**Last updated:** 2026-05-22  
**Purpose:** Checklist for Google sign-in and Firebase Auth across **local dev**, **production web**, and **future mobile / WebView** packaging.

**Client behaviour:** `lib/googleAuth.ts` uses **popup** on `localhost` / `127.0.0.1` and **redirect** elsewhere. Production flows depend on correct **authorized domains** and **OAuth client** settings.

---

## 1. Environment URLs

| Variable | Role |
|----------|------|
| `NEXT_PUBLIC_APP_URL` | Canonical site URL for metadata and mental model; set to production origin in deploy (see `ENV-VARS.md`). |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain (usually `<projectId>.firebaseapp.com` or custom auth domain). |

Local dev default in this repo: **`http://localhost:3001`** (`npm run dev` uses `-p 3001`).

Important local-mode distinction:

- `npm run dev:emulator` / `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` uses the Firebase Auth Emulator. Real Google accounts and real production email/password users are not available in that isolated emulator store.
- `npm run dev:live-auth` / `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false` uses the configured real Firebase project, so Google sign-in, email sign-up/sign-in, and real password reset behavior can be tested from `localhost:3001`.

---

## 2. Firebase Console — Authentication

**Authentication → Settings → Authorized domains**

Include at least:

- `localhost` (covers port 3001 during local testing)
- Your **production** host (e.g. `app.example.com`)
- `firebaseapp.com` / project hosting domain as created by Firebase

**Custom domain:** If you use Firebase Hosting on a custom domain, add that host here.

---

## 3. Google Cloud Console — OAuth 2.0 (Web client)

Used by Firebase Auth with Google provider. Open **Google Cloud Console** → **APIs & Services** → **Credentials** → the **Web client** linked to Firebase (or the OAuth client ID shown in Firebase project settings).

### Authorized JavaScript origins

Add every origin where the app is loaded:

| Origin | When |
|--------|------|
| `http://localhost:3001` | Local dev (match your dev port) |
| `https://<your-production-domain>` | Production |
| `https://<project-id>.firebaseapp.com` | Firebase default hosting (if used) |

Add additional origins if you use **preview deploy URLs** (e.g. Vercel) for testing OAuth.

### Authorized redirect URIs

Firebase Auth uses handlers such as:

- `https://<project-id>.firebaseapp.com/__/auth/handler`

If you use a **custom auth domain**, include the same path on that domain, e.g.:

- `https://auth.example.com/__/auth/handler`

Exact values appear in **Firebase Console → Authentication → Settings** (Authorized domains / OAuth redirect provider configuration). Align Google Cloud redirect URIs with what Firebase documents for your project.

---

## 4. Mobile / Capacitor / WebView (future)

When the site runs inside a **WebView** or **Capacitor** shell:

- The **loaded origin** must appear under **Authorized JavaScript origins** (e.g. `https://app.example.com` or the HTTPS origin you assign to the WebView).
- **Popup** flows often fail in embedded WebViews; the app may need to force **redirect** or use a **custom scheme / trusted HTTPS** pattern — retest `signInWithGoogle` after packaging.
- Add any **iOS/Android** reverse-client IDs or platform-specific OAuth steps per Firebase + Google docs when you add native Google Sign-In (not required for pure web).

See `MOBILE-PACKAGING.md` for packaging direction.

---

## 5. Verification

1. **Local emulator:** Start `npm run emulators:start` and `npm run dev:emulator`; test local email/password accounts only.
2. **Local real-auth rehearsal:** Start `npm run dev:live-auth`; sign in with Google at `http://localhost:3001` (popup path), create an email/password account, sign out/in, and request a password reset.
3. **Production:** Sign in on the live HTTPS URL (redirect path); confirm return to app without `auth/unauthorized-domain` or redirect errors.
4. After domain changes, wait a few minutes for Google OAuth config to propagate.

---

## Related

- `FIREBASE-SURFACE.md` — callable functions and regions  
- `ENV-VARS.md` — env template  
- `HTTP-HEADERS.md` — COOP / popup behaviour
