# Prize Pot — Launch-Readiness Fix Sprint

**Created:** 2026-05-28
**Branch:** `feature/prize-pot` (local only — see Guardrails)
**Source:** Final launch-readiness audit (2026-05-28)
**Status legend:** ⬜ not started · 🟦 in progress · ✅ done · ⏭️ deferred

This plan addresses the audit findings in severity order. Work top-to-bottom — later
phases assume the data-model work in Phase 0/1 is already in place.

---

## Guardrails (apply to every task)

These constraints carry over from the prize-pot build and MUST hold for every change:

- **Local only.** Do not push `feature/prize-pot` to the live Vercel site without explicit owner approval.
- **No functional changes to the game.** Scoring, transfers, squad assignment, and the overall
  leaderboard must behave identically. The pot is an additive layer.
- **No user-data mutations** except the explicitly listed eligibility field on `potEntries`.
- **Existing users stay untouched:** MrH (`AS8FMz7jEGW8xuEZfmfshsRj8AC3`),
  EdiHa (`VE8dgD64TDbJL47iDz6haK1bbow2`), Darren Martin (`rZ5FBgkm2tRFtxAl4xq0JIe2wl32`).
- **OK-gated execution.** Do not run destructive admin operations or deploy without an explicit "ok".
- **Clean commits.** No `Co-Authored-By` lines.
- **Rules changes are high-risk.** After editing `firestore.rules`, always run `npm run test:rules`
  before considering the task done.

---

## Target data model (build toward this)

### `settings/prizePot` (single doc, admin-writable only)
```ts
{
  enabled: boolean,            // feature on/off (mirrors NEXT_PUBLIC_ENABLE_PRIZE_POT)
  entryFeeRm: number,          // 10
  currency: string,            // "RM"
  open: boolean,               // legacy display flag (kept for back-compat)
  potLocked: boolean,          // NEW — hard server lock; true = no new entries
  entryDeadline: Timestamp | null, // NEW — entries auto-close at/after this time
  prizeSplit: { first: 60, second: 30, third: 10 }
}
```

### `potEntries/{uid}` (existing collection — one additive field)
```ts
{
  uid, displayName, code?, selfDeclaredAt?, selfDeclared?,
  status: "pending" | "confirmed",
  amount?, currency?, paidAt?, confirmedAt?, confirmedBy?, note?,
  eligibleForPot?: boolean      // NEW — set true ONLY by confirmPotEntry
}
```

**Eligibility rule:** a user is prize-eligible iff `potEntries/{uid}.status === "confirmed"`.
The overall game leaderboard is unchanged and ranks everyone. The **Prize Pot standings**
are computed as `leaderboard rows ∩ confirmed entries`.

---

# PHASE 1 — F-02 (Critical): Server-enforced entry lock

**Goal:** Closing the pot must be enforced by Firestore rules, not just hidden in the UI.

### Task 1.1 — Extend `settings/prizePot` writes ⬜
- **File:** `app/admin/pot/page.tsx`
- Replace the current `{ open }` toggle write with writes to `potLocked` (and optionally
  `entryDeadline`). Keep `open` for back-compat, but treat `potLocked` as the source of truth.
- Add an admin control to set/clear `entryDeadline` (a datetime input is enough).
- **Acceptance:** Admin can lock/unlock the pot and set a deadline; values persist in Firestore.

### Task 1.2 — Enforce lock in Firestore rules ⬜
- **File:** `firestore.rules` (`match /potEntries/{uid}`)
- Add helper functions and gate the `create` rule:
  ```
  function potCfgExists() {
    return exists(/databases/$(database)/documents/settings/prizePot);
  }
  function potCfg() {
    return get(/databases/$(database)/documents/settings/prizePot).data;
  }
  function entriesOpen() {
    return !potCfgExists()
      || (potCfg().potLocked != true
          && (!("entryDeadline" in potCfg())
              || potCfg().entryDeadline == null
              || request.time < potCfg().entryDeadline));
  }
  ```
  Then add `&& entriesOpen()` to the existing `potEntries` `create` condition.
- **Acceptance:** With `potLocked: true` (or past deadline), a direct client `setDoc(potEntries/{uid})` is rejected.
- **Verify:** `npm run test:rules` — add an emulator case `assertFails` for create-when-locked,
  `assertSucceeds` for create-when-open.

### Task 1.3 — Client reads the real lock state ⬜
- **File:** `app/pot/page.client.tsx`
- The listener already reads `settings/prizePot`. Switch the "closed" gate from `open === false`
  to `potLocked === true || (entryDeadline && now >= entryDeadline)`.
- Keep the existing "Entries closed" card. Confirmed users still see "You're in".
- **Acceptance:** Locking from admin hides the QR for non-confirmed users within the live listener tick.

---

# PHASE 2 — F-01 (Critical): Eligibility flag + separate Prize Pot standings

**Goal:** Paid and unpaid players must be distinguishable; payout is read from a pot-only table.

### Task 2.1 — Set eligibility on confirmation ⬜
- **File:** `functions/src/pot.ts` (`confirmPotEntry`)
- Add `eligibleForPot: true` to the `set(..., { merge: true })` payload.
- Optionally validate `amount === settings.entryFeeRm` (defensive; admin currently passes it from config).
- Mirror: `removePotEntry` already deletes the doc, so eligibility is removed implicitly. No change needed.
- **Acceptance:** Confirming an entry writes `eligibleForPot: true`; removing deletes the doc.
- **Verify:** `npm run test:rehearsal` (or a focused emulator call) — confirm sets the flag.

### Task 2.2 — Prize Pot standings (read-side intersection) ⬜
- **Files:** `app/leaderboard/page.tsx`, `components/leaderboard/LeaderboardPanel.tsx`
- The leaderboard already reads `leaderboard/current.rows` (uid, name, totalScore, rank).
- Confirmed `potEntries` are readable by any signed-in user (existing rule:
  `resource.data.status == "confirmed"`). Add a listener:
  `query(collection(db,"potEntries"), where("status","==","confirmed"))` → build a `Set<uid>`.
- Add a **toggle / second tab**: "Overall" (existing, unchanged) and "Prize Pot".
  Prize Pot view = leaderboard rows filtered to the confirmed-uid set, **re-ranked 1..N**,
  with the live RM payout for ranks 1–3 (reuse `PRIZE_SPLIT` + pot total).
- **Acceptance:** An unpaid user who is #1 overall does **not** appear in Prize Pot standings;
  the Prize Pot #1 is the top *confirmed* player.
- **Verify:** Manual — seed an unpaid mock user above a paid one; check both tabs.

### Task 2.3 — Admin export of confirmed entrants ⬜
- **File:** `functions/src/pot.ts` (new callable `exportConfirmedEntrants`, admin-only) + wire into `app/admin/pot/page.tsx`.
- Returns `[{ uid, displayName, code, amount, currency, confirmedAt }]` for all confirmed entries.
- Admin page renders a copyable list / CSV-style block to snapshot before the deadline.
- **Acceptance:** Admin can produce a frozen list of paid entrants for the payout record.
- **Verify:** Call returns only confirmed entries; non-admin gets `permission-denied`.

---

# PHASE 3 — F-03 (High): football-data.org proof-of-access

**Goal:** Prove live scores will actually arrive before relying on them.

### Task 3.1 — Run the provider smoke test ✅ (2026-05-28)
- **Command:** `npm run test:provider:football-data` (script: `scripts/test-football-data-shadow-proof.ts`)
  with the real `FOOTBALL_DATA_TOKEN` set.
- **Acceptance:** Returns ≥1 mapped match for the 2026 competition; save the console output as evidence.
- **Result:** 104 raw matches from API (competition WC, season 2026); 24 mapped and ingested (max-24 cap);
  32 dropped — all are TBD knockout bracket placeholders (`tla: "null"`, expected pre-tournament);
  0 provider errors; shadow leaderboard computed successfully. Script exited code 0.

### Task 3.2 — Confirm competition + season IDs ✅ (2026-05-28)
- **Files:** `functions/src/providers/footballDataProvider.ts`, `functions/src/providers/providerUtils.ts`, env.
- Verify `FOOTBALL_DATA_COMPETITION` and `FOOTBALL_DATA_SEASON` resolve to the real 2026 World Cup
  on your plan (defaults are currently `…DEFAULT` + `"2026"`). Set them explicitly in env, not defaults.
- **Acceptance:** IDs documented in `docs/current/ENV-VARS.md` and set in the functions runtime config.
- **Result:** `FOOTBALL_DATA_COMPETITION=WC` and `FOOTBALL_DATA_SEASON=2026` confirmed correct (smoke test
  returned real 2026 WC data). Both are now documented in `docs/current/ENV-VARS.md`. Set these explicitly
  in the Firebase runtime config/env before go-live so defaults are not relied on.

### Task 3.3 — Confirm token is server-only ✅ (2026-05-28)
- `FOOTBALL_DATA_TOKEN` is bound as a Functions secret and never `NEXT_PUBLIC_*`. Confirm no leak.
- **Verify:** `grep -r "FOOTBALL_DATA" .env.local .env.example` shows no `NEXT_PUBLIC_` prefix.
- **Result:** No `NEXT_PUBLIC_FOOTBALL_DATA*` found anywhere in the codebase. Token is defined exclusively
  via `defineSecret("FOOTBALL_DATA_TOKEN")` in `functions/src/providers/providerUtils.ts` — server-only. ✅

---

# PHASE 4 — F-04 (High): Resolve card-scoring plan dependency

**Goal:** Published rules must match what the data provider actually delivers.

### Task 4.1 — Decide cards in or out ✅ (2026-05-28)
- **Decision needed (owner):** Does your football-data.org plan include `bookings` (Deep Data)?
- **Decision: KEEP card scoring.** Plan confirmed as "Free + Deep Data" (€29/mo) which explicitly
  includes "Bookings / Cards". No code or rules changes needed.

### Task 4.2 — Verify cards end-to-end ⏭️ (post tournament start — ~June 11 2026)
- Ingest a real finished match with a known red/yellow; confirm the penalty lands in team points.
- **Acceptance:** Card penalty observed in recompute output for a known match.
- **Blocked until:** First finished match is available from the API.

### Task 4.3 — Align rules copy ✅ (already aligned)
- **Files:** `app/guide/page.tsx` lines 25–26 already show "Yellow card = −0.5 pts" / "Red card = −1 pt".
- Scoring engine and dashboard preview match. No changes required.

---

# PHASE 5 — F-05 (Medium-High): Remove email from leaderboard display

**Goal:** No staff email should ever render on a shared table.

### Task 5.1 — Drop email from the displayName fallback ⬜
- **File:** `functions/src/scoring.ts` (~L508–513)
- Change `… ?? asString(data.name) ?? asString(data.email) ?? "Anonymous"` →
  `… ?? asString(data.name) ?? "Player"` (drop the `email` term).
- **Acceptance:** A user with only an email shows "Player" (or initials), never the email.
- **Verify:** Recompute with a name-less test user; inspect `leaderboard/current.rows`.
- **Note:** `getSquadDetails.ts` already uses email *local-part initials* only — no change needed there,
  but double-check it stays that way.

---

# PHASE 6 — F-06 (Medium): Pot rules, language & organiser sign-off

**Goal:** Players understand the deal before paying; organiser approves the pool.

### Task 6.1 — Add a rules block to `/pot` ⬜
- **File:** `app/pot/page.client.tsx`
- Short, plain-English block shown before the "I've paid" action:
  - RM10 entry, optional.
  - Payment is manual via Touch 'n Go QR.
  - **Eligibility requires admin-confirmed payment before the entry deadline.**
  - 60/30/10 split; ties at a position split equally.
  - What happens if the game is cancelled / provider fails / a dispute arises (organiser decides; refunds at organiser discretion).
  - No automated payment verification — confirmation is manual.
- Avoid gambling language (no odds/wager/bet/jackpot). ✅ already clean — keep it that way.

### Task 6.2 — Organiser approval gate ⬜
- **Action (owner, not code):** Get explicit organiser sign-off for a workplace-pooled-money prize.
  Flag for local policy / HR review. *(Not legal advice — this is a process checkpoint.)*
- **Acceptance:** Sign-off recorded before the pot is advertised.

---

# PHASE 7 — F-07 (Low): Charity dormant-code cleanup ⏭️ (backlog)

- **Files:** `lib/charity.ts`, `app/charity/*`, `docs/current/CHARITY-PAYMENTS.md`
- Confirm `/charity` renders harmlessly when `FEATURES.charityPot === false`, or remove the route.
- Not launch-blocking; do after the above.

---

## Regression test gate (run before declaring the sprint done)

| Command | Covers |
|---|---|
| `npm run test:rules` | Rules incl. new pot-lock (Task 1.2) |
| `npm run test:rehearsal` | transfer, transfer-closed, squad-authz, ingest-validation, shadow-routing, dirty-retry |
| `npm run test:provider:football-data` | Live provider proof (Phase 3) |
| `npm run test:load-sim` | 150-user read/write within free tier |
| `npx tsc --noEmit` (root) | App type-check |
| `cd functions && npm run build` | Functions type-check |

Manual checks: unpaid-user exclusion from Prize Pot standings (Task 2.2); lock hides QR (Task 1.3);
email-free leaderboard (Task 5.1).

---

## Suggested sequencing for sessions with Sonnet 4.6

1. **Session A — Data model + lock (Phase 1):** Tasks 1.1 → 1.2 → 1.3, end with `npm run test:rules`.
2. **Session B — Eligibility + standings (Phase 2):** Tasks 2.1 → 2.2 → 2.3.
3. **Session C — Provider + cards (Phases 3 & 4):** mostly verification + a decision; small code edits.
4. **Session D — Email + rules copy + cleanup (Phases 5–7):** quick, low-risk edits.

Each session: make the change, run the relevant test from the gate table, commit with a clean message,
do **not** deploy without an explicit "ok".
