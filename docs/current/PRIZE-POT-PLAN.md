# Prize Pot — Build Plan
# World Cup 2026 Sweepstakes

**Created:** 2026-05-27  
**Branch:** `feature/prize-pot` — **never merge to `main` without explicit owner approval**  
**Purpose:** Add an optional, QR-code-first prize pot system to the sweepstakes. Players who pay into the pot are eligible to win it; non-paying players continue to play the game normally.

---

## Isolation & Deployment Safety

All prize pot code lives exclusively on the `feature/prize-pot` branch.

| Rule | Detail |
|------|--------|
| Branch | `feature/prize-pot` — not `main` |
| Vercel | Deploys from `main` only — this branch is invisible to production until a deliberate merge |
| Feature flag | `NEXT_PUBLIC_ENABLE_PRIZE_POT=true` must be set in the environment for anything to render — defaults to off |
| Merge trigger | Owner must explicitly say "merge prize pot to main" |

To activate on production when ready:
1. `git checkout main && git merge feature/prize-pot`
2. Set `NEXT_PUBLIC_ENABLE_PRIZE_POT=true` in Vercel environment variables
3. Set all other `NEXT_PUBLIC_PRIZE_POT_*` env vars (see Bundle P5)
4. Push — Vercel auto-deploys

---

## Hard Constraints (inherited from scalability sprint)

1. **No functional changes.** Scoring, transfers, squad assignment, leaderboard work identically.
2. **No user data mutations** on existing collections unless explicitly listed.
3. **Existing users stay in the game.** MrH / AS8FMz7jEGW8xuEZfmfshsRj8AC3, EdiHa / VE8dgD64TDbJL47iDz6haK1bbow2, Darren Martin / rZ5FBgkm2tRFtxAl4xq0JIe2wl32 are unaffected.
4. **OK-gated execution.** No bundle executed until owner approves with "ok".
5. **Clean commits.** No `Co-Authored-By` lines.

---

## Concept Summary

The prize pot is a traditional sweepstakes mechanic layered on top of the existing game:

- Participation is **entirely optional** — it is not a gate to entering the game
- Players pay a fixed amount (e.g. RM 10) out-of-band via QR code (Touch 'n Go / DuitNow)
- Admin confirms receipt manually in the admin panel → Cloud Function writes the entry
- Players who have paid are marked "in the pot" and eligible to win
- The pot page shows the current total, QR code, personal payment status, and (optionally) who's in

**Payment flow:**
```
Player                      Admin                       Firestore
  │                           │                             │
  │── Scan QR code ──────────>│                             │
  │── Pay via TnG ───────────>│                             │
  │── [optional] WhatsApp ───>│                             │
  │                           │── Verify in TnG app         │
  │                           │── Tap "Confirm" in admin ──>│
  │                           │                         write potEntries/{uid}
  │<── Status updates to ✓ ───────────────────────────────── │
```

---

## Bundle Specifications

### Bundle P1 — Rename & Rebrand Config Layer
**Status:** ☐ Pending

**Scope:** Remove all "charity" language from the config and nav. Replace with "prize pot" language. No UI changes yet — config layer only.

**Changes:**
| File | Action | Detail |
|------|--------|--------|
| `lib/prizePot.ts` | **New** (replaces `lib/charity.ts`) | `PRIZE_POT_CONFIG` with `potName`, `amountPerEntry`, `currency`, `qrCodeImageUrl`, `whatsappConfirmUrl`, `showParticipants` |
| `lib/features.ts` | **Edit** | Add `prizePot` feature key alongside existing `charityPot`; env var `NEXT_PUBLIC_ENABLE_PRIZE_POT` |
| `lib/mainNav.ts` | **Edit** | Add `prizePot` nav item (`id: "pot"`, `label: "Pot"`, `icon: Coins`, `href: "/pot"`) gated on `FEATURES.prizePot`; leave existing `charity` item untouched |
| `lib/charity.ts` | **Leave** | Not deleted — existing charity code stays intact and separate |

> Charity and prize pot coexist during the branch lifetime. Charity is off (`NEXT_PUBLIC_ENABLE_CHARITY_POT` is not set). Prize pot is separately flagged.

**Verification:** TypeScript compiles cleanly (`npx tsc --noEmit`).

---

### Bundle P2 — Firestore: `potEntries` Collection + Admin Cloud Function
**Status:** ☐ Pending

**Firestore document schema:**
```
potEntries/{uid}
  uid:           string     — matches the document ID
  displayName:   string     — copied from users/{uid} at confirm time
  paidAt:        Timestamp  — server timestamp set by Cloud Function
  amount:        number     — entry amount in local currency (e.g. 10)
  currency:      string     — e.g. "RM"
  confirmedBy:   string     — admin uid who confirmed
  note:          string     — optional admin freetext
```

**Cloud Function:** `confirmPotEntry` (admin-only callable)
- Callable only by users with `admin: true` custom claim — throws `permission-denied` otherwise
- Params: `{ uid: string, amount: number, currency: string, note?: string }`
- Reads `users/{uid}` to get `displayName`
- Creates/overwrites `potEntries/{uid}` with server timestamp
- Idempotent — calling twice just updates `paidAt` and `confirmedBy`

**Firestore rules addition:**
```
match /potEntries/{uid} {
  // Owner can read their own entry status
  allow read: if signedIn() && request.auth.uid == uid;
  // No client writes — all writes go through the admin Cloud Function
  allow write: if false;
}
```

**Files changed:**
- `functions/src/pot.ts` (new)
- `functions/src/index.ts` — export `confirmPotEntry`
- `firestore.rules` — add `potEntries` rules

**Verification:** `npm run test:rehearsal` — all existing tests still pass.

---

### Bundle P3 — Prize Pot Page (`/pot`)
**Status:** ☐ Pending

**Route:** `/pot` — gated by `PRIZE_POT_CONFIG.enabled` (returns `notFound()` if off)

**Page sections:**

**1. Hero — pot summary**
- Heading: `PRIZE_POT_CONFIG.potName` (e.g. "World Cup 2026 Prize Pot")
- Live pot total: `entryCount × amountPerEntry` — computed from a live Firestore `potEntries` count query (admin-readable total; individual entries stay private)
- Entry amount badge: e.g. `RM 10 per entry`

**2. QR payment section**
- QR code image from `PRIZE_POT_CONFIG.qrCodeImageUrl` (static asset — upload your TnG/DuitNow QR image once, paste URL)
- Step-by-step "How to enter" list:
  1. Open Touch 'n Go / your banking app
  2. Scan this QR code
  3. Pay RM 10 — use your display name as the reference
  4. [Optional] WhatsApp the admin to confirm (link from `whatsappConfirmUrl`)
- Amount displayed prominently so it's unambiguous

**3. Your status card**
- Signed in + `potEntries/{uid}` exists → **"✓ You're in the pot!"** (green, shows `paidAt` date and amount)
- Signed in + no entry doc → **"Not yet entered"** (neutral, shows the QR section as CTA)
- Not signed in → sign-in prompt

**4. Participants section** (conditional)
- If `PRIZE_POT_CONFIG.showParticipants = true` → list of `displayName` values from `potEntries` (names only, no UIDs, no amounts)
- If false → "**N players** have entered the pot" (count only)

**Files changed:**
- `app/pot/page.tsx` (new — thin server component, gated by feature flag)
- `app/pot/page.client.tsx` (new — full client component)

**Verification:** Visual check at `localhost:3001/pot` with `NEXT_PUBLIC_ENABLE_PRIZE_POT=true` set in `.env.local`.

---

### Bundle P4 — Admin Confirmation Panel
**Status:** ☐ Pending

**Scope:** Add a "Prize Pot" section to the existing admin panel. Admins can see all participants and confirm new payments.

> Location TBD — need to find the existing admin panel route (`/admin` or similar) before writing code.

**Admin panel additions:**
- "Prize Pot" card/tab showing:
  - Total entries confirmed, total pot amount
  - Table: `displayName` | `amount` | `paidAt` | `confirmedBy` | `note` for each entry
- "Confirm Payment" action per user:
  - Dropdown/search of all users (from `users` collection)
  - Amount field (pre-filled from config)
  - Optional note field
  - Calls `confirmPotEntry` Cloud Function
  - Shows success/error inline

**Files changed:**
- Existing admin page file (TBD — to be located before bundle execution)

**Verification:** Sign in as admin, confirm a test entry, verify `potEntries` doc written in Firestore emulator.

---

### Bundle P5 — Environment Variables & Documentation
**Status:** ☐ Pending

**Env vars to add to `.env.local` for local development:**
```bash
NEXT_PUBLIC_ENABLE_PRIZE_POT=true
NEXT_PUBLIC_PRIZE_POT_NAME="World Cup 2026 Prize Pot"
NEXT_PUBLIC_PRIZE_POT_AMOUNT=10
NEXT_PUBLIC_PRIZE_POT_CURRENCY=RM
NEXT_PUBLIC_PRIZE_POT_QR_IMAGE_URL=https://...      # Upload your TnG/DuitNow QR image, paste URL
NEXT_PUBLIC_PRIZE_POT_WHATSAPP_URL=https://wa.me/60XXXXXXXXX  # Optional — admin WhatsApp deep link
NEXT_PUBLIC_PRIZE_POT_SHOW_PARTICIPANTS=true
```

**When going live (Vercel):**
1. Merge `feature/prize-pot` → `main`
2. Set all `NEXT_PUBLIC_PRIZE_POT_*` vars in Vercel dashboard → Environment Variables
3. Redeploy

**Files changed:**
- `.env.local` — add all vars above (this file is gitignored — never committed)
- `docs/current/PRIZE-POT-PLAN.md` — mark bundles complete

---

## Bundle Execution Log

| Bundle | Status | Commit | Notes |
|--------|--------|--------|-------|
| P1 — Config rebrand | ✅ | `feat(prize-pot): P1 — config layer and nav item` | prizePot.ts, features.ts, mainNav.ts |
| P2 — Firestore + Cloud Function | ✅ | `feat(prize-pot): P2 — potEntries collection, confirmPotEntry Cloud Function` | pot.ts, firestore.rules |
| P3 — Prize Pot page (`/pot`) | ✅ | `feat(prize-pot): P3+P4 — self-declaration flow, unique codes, admin panel` | app/pot/ |
| P4 — Admin confirmation panel | ✅ | `feat(prize-pot): P3+P4 — self-declaration flow, unique codes, admin panel` | app/admin/pot/ |
| P5 — Env vars + docs | ☐ | — | |

---

## Key Files Reference

| File | Role |
|------|------|
| `lib/prizePot.ts` | Config — pot name, amount, QR URL, WhatsApp link |
| `lib/features.ts` | Feature flag — `NEXT_PUBLIC_ENABLE_PRIZE_POT` |
| `lib/mainNav.ts` | Nav — adds "Pot" item when flag is on |
| `functions/src/pot.ts` | Cloud Function — `confirmPotEntry` (admin only) |
| `firestore.rules` | `potEntries` read/write rules |
| `app/pot/page.tsx` | Route — server component, feature-gate |
| `app/pot/page.client.tsx` | UI — QR display, status, participants |
| `app/admin/...` | Admin panel additions (location TBD in P4) |

---

## Going Live Checklist

When you decide to activate:

- [ ] `git checkout main && git merge feature/prize-pot`
- [ ] Upload TnG/DuitNow QR image to a stable URL (Firebase Storage recommended)
- [ ] Set all `NEXT_PUBLIC_PRIZE_POT_*` env vars in Vercel
- [ ] Set `NEXT_PUBLIC_ENABLE_PRIZE_POT=true` in Vercel
- [ ] Push to trigger Vercel deploy
- [ ] Smoke test `/pot` as MrH — confirm QR displays, status shows "Not yet entered"
- [ ] Test admin panel: confirm a payment, verify status flips to "✓ You're in the pot!"

---

*This document is the authoritative source of truth for the prize pot feature. Branch: `feature/prize-pot`. Do not merge to `main` without explicit owner approval.*
