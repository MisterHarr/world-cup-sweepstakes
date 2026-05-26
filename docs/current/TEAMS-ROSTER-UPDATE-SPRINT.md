# Sprint build — World Cup 2026 full roster (`TEAMS_SEED`)

**Created:** 2026-05-02  
**Goal:** Replace playoff **placeholders** in `lib/seed/teamsSeed.ts`, align all 48 teams with the **official** qualified list + groups, clean **Firestore** orphans, align **fixtures**, and handle **user data** if placeholders were ever assigned.

**Process:** Complete work in **bundles of two micro-steps** (M1+M2, then M3+M4, …). After each bundle, the implementer posts in chat **(1) what changed** and **(2) what to test locally (UX/UI)**; then proposes the **next** two-step bundle and waits for **`ok`** before coding. This file tracks scope and checkboxes only — not step-by-step test scripts.

**Related:** `lib/seed/teamsSeed.ts`, **`docs/current/WORLD-CUP-2026-ROSTER.md`** (frozen table), `/admin/seed-teams`, `docs/current/ADMIN-TOOLS.md`, `docs/current/TOURNAMENT-RUNBOOK.md` (if present).

**Local servers:** Next.js defaults to **`http://localhost:3001`** (`npm run dev`). Firebase emulators: **Auth `9099`**, **Firestore `8080`**, **Functions `5001`** (see `firebase.json`). Emulator **UI** is set to **`enabled: false`** so startup does not require port **4000**; turn it back on in `firebase.json` when you want the web UI and that port is free.

---

## Sprint 1 — Authoritative roster & validation

| ID | Micro-step | Done |
|----|------------|------|
| S1-M1 | Add **`docs/current/WORLD-CUP-2026-ROSTER.md`**: official source URL(s), freeze date, and a **48-row table** (`id`, `name`, `group`, optional order within group). No code changes yet. | ✅ |
| S1-M2 | Add a **validation guard** for `TEAMS_SEED`: e.g. `scripts/validate-teams-seed.ts` (or Vitest/Jest test) asserting **48** teams, **unique** `id`s, groups **A–L** each with **exactly 4** teams. Wire to `npm run` script. | ✅ |

**Exit:** Roster is written down once; CI or a one-command check can catch structural mistakes before/after seed edits.

---

## Sprint 2 — `teamsSeed.ts` content

| ID | Micro-step | Done |
|----|------------|------|
| S2-M1 | In **`lib/seed/teamsSeed.ts`**, replace all **`PO_UE_*`** and **`PO_FIFA_*`** rows with real nations per `WORLD-CUP-2026-ROSTER.md` (`id`, `name`, `group`, `flagUrl`). Adjust **non-placeholder** rows only if the official table differs (name/group/order). | ✅ |
| S2-M2 | Reconcile **`tier` (1–4)** per group with product rules; update **file header comment** (remove “placeholders”, cite roster doc + date). Run **`validate-teams-seed`** from S1-M2 until green. | ✅ |

**Exit:** `TEAMS_SEED` matches the frozen roster; structure validated by script/test.

---

## Sprint 3 — Firestore teams collection

| ID | Micro-step | Done |
|----|------------|------|
| S3-M1 | **Orphan cleanup:** Document and implement one of: (a) admin-only script/page that **deletes** `teams/{id}` for ids **not** in `TEAMS_SEED`, or (b) explicit list of retired ids (`PO_UE_A`, …) to delete after re-seed. Prefer (a) for repeatability. | ✅ |
| S3-M2 | **Re-seed:** Run **`/admin/seed-teams`** against staging/emulator first; then production when approved. Confirm **`merge`** behaviour documented (updates in place; orphans need S3-M1). | ✅ |

**Exit:** Firestore `teams` matches `TEAMS_SEED`; no stale `PO_*` documents remain.

---

## Sprint 4 — Fixtures & ingest

| ID | Micro-step | Done |
|----|------------|------|
| S4-M1 | **Audit** match/fixture data (Firestore `matches`, JSON under `functions/`, admin ingest paths) for **`PO_*`** or **wrong `teamId`s**. Fix ingest payloads or re-run admin fixture flows so **home/away** ids match `TEAMS_SEED`. | ✅ |
| S4-M2 | Update **ops docs** (`TOURNAMENT-RUNBOOK`, `ADMIN-TOOLS`): roster freeze date, “after roster change” checklist (seed teams → delete orphans → verify fixtures). | ✅ |

**Exit:** Live/scoring paths resolve teams correctly; operators have a short runbook.

---

## Sprint 5 — User data & QA

| ID | Micro-step | Done |
|----|------------|------|
| S5-M1 | **User migration plan:** If any user could hold a **`PO_*`** `teamId` in `portfolio` / `entry`, document **detection** (query pattern or admin report) and **remediation** (map to final id vs reset entry vs support ticket). Implement only if needed. | ✅ |
| S5-M2 | **QA pass:** Featured team picker, transfers (if open), dashboard squad, leaderboard — **48** teams visible; flags load; no unknown teams. Record result in status log below. | ✅ |

**Exit:** Roster sprint complete — see **§ Roster sprint complete** below. Operator records QA pass/fail in the status log; retired-id users handled or documented “none found”.

---

## Bundle order (strict)

Execute micro-steps in **numeric order** within each sprint; combine **two at a time** per pass:

| Pass | Steps |
|------|--------|
| 1 | S1-M1 + S1-M2 |
| 2 | S2-M1 + S2-M2 |
| 3 | S3-M1 + S3-M2 |
| 4 | S4-M1 + S4-M2 |
| 5 | S5-M1 + S5-M2 |

---

## Placeholder ids (retired after Sprint 2)

`PO_UE_D` → `CZE` · `PO_UE_A` → `BIH` · `PO_UE_C` → `TUR` · `PO_UE_B` → `SWE` · `PO_FIFA_2` → `IRQ` · `PO_FIFA_1` → `COD` — see **`WORLD-CUP-2026-ROSTER.md`**.

---

## Status log

| Date | Bundle | Notes |
|------|--------|-------|
| 2026-05-02 | S1-M1 + S1-M2 | `WORLD-CUP-2026-ROSTER.md` + `scripts/validate-teams-seed.ts` + `npm run validate:teams-seed`; dev + emulators started for local test |
| 2026-05-02 | S2-M1 + S2-M2 | Full roster + draw order in `teamsSeed.ts`; tiers = roster slots; names (Czechia, IR Iran, Côte d'Ivoire, Türkiye); new ids `CZE` `BIH` `TUR` `SWE` `IRQ` `COD` |
| 2026-05-02 | S3-M1 + S3-M2 | `/admin/seed-teams`: orphan delete button + merge/orphan copy; `ADMIN-TOOLS.md` Seed Teams section |
| 2026-05-02 | S4-M1 + S4-M2 | `scripts/audit-fixture-team-ids.ts` + `npm run audit:fixture-teams`; `TOURNAMENT-RUNBOOK` §1.1; `ADMIN-TOOLS` fixture note |
| 2026-05-02 | S5-M1 + S5-M2 | `ADMIN-TOOLS` “Roster change: user documents”; sprint exit — **QA: operator-run** (record Pass/Fail below) |
| | **QA smoke** | *(operator: `Pass` / `Fail — …` after checklist)* |

---

## Roster sprint complete

All five passes delivered: frozen roster doc, `TEAMS_SEED` + validators, Firestore seed/orphan admin UI, fixture audit script + runbook/admin notes, user-doc migration guidance.

**Operator:** Run your final smoke (see chat handoff after Pass 5), then add one line to the status log: `QA smoke: Pass` or `QA smoke: Fail — …`.
