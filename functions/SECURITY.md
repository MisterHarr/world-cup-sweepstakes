# Security Documentation

## Environment Variables

### Client-Side (.env.local)
All variables in `.env.local` use the `NEXT_PUBLIC_` prefix, which makes them **safe for client-side exposure**. These are Firebase client SDK configuration values that are designed to be public.

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

**Security Notes:**
- These values are bundled into the client JavaScript and are **intentionally public**
- Firebase API keys are **not secret** - they identify your project, not authenticate it
- Security is enforced by Firebase Security Rules and Cloud Functions auth checks
- `.env.local` is in `.gitignore` to prevent accidental commits

### Server-Side (Cloud Functions)
Cloud Functions use the **Firebase Admin SDK**, which authenticates via:
1. **Application Default Credentials (ADC)** when deployed to Firebase
2. **Service Account Key** for local development (if needed)

**CRITICAL:** Never commit service account JSON files to git.

## Rate Limiting

All callable Cloud Functions implement rate limiting to prevent abuse:

| Function | Limit | Window |
|----------|-------|--------|
| `executeTransfer` | 5 requests | 60 seconds |
| `confirmFeaturedTeam` | 10 requests | 60 seconds |
| `setDepartment` | 3 requests | 1 hour |
| `setAdminClaim` | 20 requests | 60 seconds |

Rate limits are enforced **per user** (by UID) and return `resource-exhausted` error when exceeded.

## Input Validation

All user inputs are validated using type-safe validators:

- **Team IDs:** Alphanumeric with hyphens/underscores, 1-50 chars
- **UIDs:** Alphanumeric, 10-128 chars
- **Departments:** Enum validation (Primary, Secondary, Admin)
- **Strings:** Trimmed, min/max length enforced
- **Numbers:** Range validation, integer checks

## Firebase Security Rules

### User Documents (`/users/{uid}`)
- **Read:** User can only read their own document
- **Create:** User can create their own document with safe defaults only
- **Update:** User can only update profile fields (displayName, email, photoURL)
- **Sensitive fields** (portfolio, totalScore, remainingTransfers, entry, department, isAdmin) can **only be updated via Cloud Functions**

### Teams, Matches, Leaderboard
- **Read:** Any authenticated user
- **Write:** Admin users only (via Cloud Functions with Admin SDK)

### Settings
- **Read:** Any authenticated user
- **Write:** Admin users only

## Admin Security

### Admin Claim System
- Admin status is stored as a **custom claim** on the Firebase Auth token
- Claims are **immutable** from client-side
- Only callable functions can modify claims (via `setAdminClaim`)
- `setAdminClaim` requires existing admin auth to prevent privilege escalation

### No bootstrapAdmin Function
The application does **not** include an open bootstrapAdmin function. Admin users must be promoted manually via:
1. Firebase Console → Authentication → Users → Set custom claims
2. Or via existing admin using `setAdminClaim` callable function

## Content Security Policy (CSP)

CSP headers are enforced via `middleware.ts`:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.googleapis.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https: blob:;
  font-src 'self' data:;
  connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com;
  frame-ancestors 'none';
```

Additional security headers:
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security` (production only)
- `Permissions-Policy` - Restricts browser features

## Production Logging

All logging uses conditional utilities from `functions/src/utils/logger.ts`:

- **Development:** Full error details logged to console
- **Production:** Generic user-facing messages, sanitized error logs
- **No PII** in logs (UIDs are hashed if logged)

## Best Practices

1. **Never commit:**
   - Service account JSON files
   - API keys or secrets (except NEXT_PUBLIC_ vars)
   - `.env.local` file (already in .gitignore)

2. **Always validate:**
   - All user inputs at Cloud Function entry points
   - Rate limit all mutations
   - Use type-safe validators from `utils/validation.ts`

3. **Always authenticate:**
   - Check `request.auth?.uid` in all callable functions
   - Use `requireAuth()` helper for user operations
   - Use `requireAdmin()` helper for admin operations

4. **Always sanitize:**
   - Error messages in production (use `sanitizeError()`)
   - Log output (use `logError()` instead of `console.error()`)
   - User-generated content (trim, validate length)

---

**Last Updated:** 2026-02-15
**Next Review:** After Sprint 3 completion
