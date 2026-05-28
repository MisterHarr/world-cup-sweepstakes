# Environment variables

**Purpose:** Single reference for auditors and operators. **Do not put secrets in `NEXT_PUBLIC_*` variables** — they are embedded in the client bundle.

## Next.js (`/.env.local`, copied from `/.env.example`)

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | Firebase Web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | e.g. `project-id.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | GCP / Firebase project id |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | Often `project-id.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes | From Firebase console |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | Web app id |
| `NEXT_PUBLIC_APP_URL` | No | Canonical site URL for Open Graph / `metadataBase` (defaults to `http://localhost:3001` if unset; dev script uses `-p 3001`) |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | No | `true` connects local browser sessions to Auth/Firestore/Functions emulators; `false` uses the configured real Firebase project. |
| `NEXT_PUBLIC_ENABLE_CHARITY_POT` | No | `true` / `1` / `on` enables charity feature flag (`lib/features.ts`) |
| `NEXT_PUBLIC_CHARITY_*` | No | See `lib/charity.ts` — campaign name, beneficiary, Stripe/PayPal links, terms, disclaimer |
| `NEXT_PUBLIC_ENABLE_PRIZE_POT` | No | `true` enables the Prize Pot feature flag (`lib/prizePot.ts`). Must be `false` or unset until the pot is open. |
| `NEXT_PUBLIC_PRIZE_POT_AMOUNT` | No | Entry fee in RM. Currently `10`. |
| `NEXT_PUBLIC_PRIZE_POT_NAME` | No | Display name, e.g. `The Pot`. |

**Standard Node:** `NODE_ENV` is set by Next.js (`development` | `production`).

## Local Auth Testing Modes

There are two different local testing lanes:

| Command | Auth behavior | Data behavior | Use for |
|---------|---------------|---------------|---------|
| `npm run dev:emulator` | Local Auth Emulator only; real Google/production accounts do not exist here. | Local Firestore/Functions emulators. | Safe onboarding/game rehearsals without touching live data. |
| `npm run dev:live-auth` | Real Firebase Auth, including Google sign-in and real password reset email flow. | Real configured Firebase project. | Full auth-provider rehearsal before launch. Use carefully because app actions can affect the configured Firebase project. |

`npm run dev` follows `.env.local`. If `.env.local` contains `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`, it behaves like the emulator lane.

For a full end-to-end launch rehearsal with Google sign-in, email sign-up/sign-in, password reset, visible scores, leaderboard updates, and transfers, use `npm run dev:live-auth` against a dedicated staging Firebase project where possible. If you point it at production, treat admin reset/rehearsal tools as production-impacting and use the existing localhost-production confirmation guards.

## Cloud Functions (`functions/` — configure in Firebase / GCP, not in the Next bundle)

Used by scheduled ingest and admin tooling (see `functions/src/ingest.ts` and related):

| Variable | Purpose |
|----------|---------|
| `FOOTBALL_DATA_TOKEN` | External football-data.org API token. **Server-only secret — never `NEXT_PUBLIC_*`.** Defined via Firebase Secret Manager (`defineSecret("FOOTBALL_DATA_TOKEN")` in `functions/src/providers/providerUtils.ts`). |
| `FOOTBALL_DATA_API_BASE` | API base URL override. Default: `https://api.football-data.org/v4`. |
| `FOOTBALL_DATA_COMPETITION` | Competition id. **2026 World Cup value: `WC`** (verified 2026-05-28 smoke test). Default in code: `WC`. Set explicitly in runtime config so upgrades don't silently change it. |
| `FOOTBALL_DATA_SEASON` | Season year. **2026 World Cup value: `2026`** (verified 2026-05-28 smoke test — 104 raw matches returned, 24 mapped). Default in code: `"2026"`. Set explicitly. |
| `FOOTBALL_DATA_STATUSES` | Status filter string. Default: `SCHEDULED,TIMED,IN_PLAY,PAUSED,FINISHED`. |
| `SPORTMONKS_TOKEN` | Sportmonks API token (fallback provider). |
| `SPORTMONKS_API_BASE` | Sportmonks API base URL override. |
| `SPORTMONKS_SEASON_ID` | Season id used for fixture/livescore fetch. |
| `LIVE_SCORES_PROVIDER` | Active provider selection (`football-data` or `sportmonks`). |
| `PROVIDER_TIMEOUT_MS` / `PROVIDER_MAX_RETRIES` | HTTP client limits. |
| `FIXTURE_MAX_MATCHES` / `FIXTURE_CUTOFF` | Ingest limits. |

### 2026 World Cup — confirmed identifiers (from smoke test 2026-05-28)

| Setting | Value | Source |
|---------|-------|--------|
| Competition | `WC` | football-data.org `/competitions/WC/matches?season=2026` returned 104 raw matches |
| Season | `2026` | As above |
| Unmapped matches | 32 of 104 | Expected — TBD knockout bracket placeholders (`tla: "null"`) that have no assigned teams yet. Will resolve once tournament bracket is set. |
| Card data (`bookings`) | **Requires Deep Data plan** | See note in `functions/src/providers/footballDataProvider.ts` L69–70. Cannot be verified pre-tournament. |

> **Action required before go-live (Phase 4):** Confirm your football-data.org plan tier includes `bookings` (Deep Data), or remove card-penalty language from the published rules. See `docs/current/PRIZE-POT-LAUNCH-SPRINT.md` Phase 4.

Document the live values only in your **secure deployment** notes (1Password, GCP Secret Manager, etc.), not in git.

## Related files

- Client Firebase init: `lib/firebase.ts` (Functions region **asia-southeast1**).
- Template: `/.env.example`.
- Callable / rules map: `docs/current/FIREBASE-SURFACE.md`.
