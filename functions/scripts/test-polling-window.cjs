#!/usr/bin/env node
// Unit tests for polling window logic and provider status normalization.
// No Firebase emulator required — these are pure functions.
/* eslint-disable no-console */
"use strict";

const assert = require("assert");
// Compiled CJS output — run `npm run build` before this script.
const { computePollingGate, isScoringRelevantChange } = require("../lib/pollingWindow.js");
const { normalizeProviderStatus } = require("../lib/providers/footballDataProvider.js");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

// Build an ISO timestamp offset by `minutes` from a fixed anchor.
const ANCHOR_MS = Date.UTC(2026, 5, 15, 20, 0, 0); // 2026-06-15 20:00 UTC

function isoAt(offsetMinutes) {
  return new Date(ANCHOR_MS + offsetMinutes * 60 * 1000).toISOString();
}

// The "now" used in every gate call — 2026-06-15 20:00:00 UTC.
const NOW = ANCHOR_MS;

// ── computePollingGate ──────────────────────────────────────────────────────

console.log("\ncomputePollingGate");

test("empty schedule → skip", () => {
  assert.strictEqual(computePollingGate(NOW, []), "skip");
});

test("entry with no kickoffTime → skip", () => {
  assert.strictEqual(computePollingGate(NOW, [{ stage: "GROUP" }]), "skip");
});

test("match 30 days in future → skip", () => {
  const schedule = [{ kickoffTime: isoAt(30 * 24 * 60), stage: "GROUP" }];
  assert.strictEqual(computePollingGate(NOW, schedule), "skip");
});

// --- pre-kickoff window boundary ---

test("20 min before kickoff → skip (not yet in window)", () => {
  const schedule = [{ kickoffTime: isoAt(20), stage: "GROUP" }];
  assert.strictEqual(computePollingGate(NOW, schedule), "skip");
});

test("10 min before kickoff (boundary) → proceed", () => {
  // windowStart = kickoff - 10min = NOW exactly
  const schedule = [{ kickoffTime: isoAt(10), stage: "GROUP" }];
  assert.strictEqual(computePollingGate(NOW, schedule), "proceed");
});

test("9 min before kickoff → proceed", () => {
  const schedule = [{ kickoffTime: isoAt(9), stage: "GROUP" }];
  assert.strictEqual(computePollingGate(NOW, schedule), "proceed");
});

test("at kickoff → proceed", () => {
  const schedule = [{ kickoffTime: isoAt(0), stage: "GROUP" }];
  assert.strictEqual(computePollingGate(NOW, schedule), "proceed");
});

// --- group match window ---

test("group match 60 min after kickoff → proceed", () => {
  const schedule = [{ kickoffTime: isoAt(-60), stage: "GROUP" }];
  assert.strictEqual(computePollingGate(NOW, schedule), "proceed");
});

test("group match 119 min after kickoff (still in 2h window) → proceed", () => {
  const schedule = [{ kickoffTime: isoAt(-119), stage: "GROUP" }];
  assert.strictEqual(computePollingGate(NOW, schedule), "proceed");
});

test("group match 120 min after kickoff (boundary end) → proceed", () => {
  const schedule = [{ kickoffTime: isoAt(-120), stage: "GROUP" }];
  assert.strictEqual(computePollingGate(NOW, schedule), "proceed");
});

test("group match 121 min after kickoff (past 2h window) → check-live", () => {
  // match finished but we can't confirm from fixture alone — caller queries Firestore
  const schedule = [{ kickoffTime: isoAt(-121), stage: "GROUP" }];
  assert.strictEqual(computePollingGate(NOW, schedule), "check-live");
});

// --- knockout match window ---

test("knockout match 100 min after kickoff (in window) → proceed", () => {
  const schedule = [{ kickoffTime: isoAt(-100), stage: "QF" }];
  assert.strictEqual(computePollingGate(NOW, schedule), "proceed");
});

test("knockout match 219 min after kickoff (still in 3h40m window) → proceed", () => {
  const schedule = [{ kickoffTime: isoAt(-219), stage: "SF" }];
  assert.strictEqual(computePollingGate(NOW, schedule), "proceed");
});

test("knockout match 220 min after kickoff (boundary end) → proceed", () => {
  const schedule = [{ kickoffTime: isoAt(-220), stage: "FINAL" }];
  assert.strictEqual(computePollingGate(NOW, schedule), "proceed");
});

test("knockout match 221 min after kickoff (ET/pens past fixed window) → check-live", () => {
  // Caller must query Firestore: if LIVE → continue, if empty → stop
  const schedule = [{ kickoffTime: isoAt(-221), stage: "SF" }];
  assert.strictEqual(computePollingGate(NOW, schedule), "check-live");
});

test("knockout match 300 min after kickoff → check-live (extreme pens)", () => {
  const schedule = [{ kickoffTime: isoAt(-300), stage: "QF" }];
  assert.strictEqual(computePollingGate(NOW, schedule), "check-live");
});

// --- multi-match schedule ---

test("one match future, one in window → proceed", () => {
  const schedule = [
    { kickoffTime: isoAt(120), stage: "GROUP" },  // future
    { kickoffTime: isoAt(-30), stage: "GROUP" },  // in window
  ];
  assert.strictEqual(computePollingGate(NOW, schedule), "proceed");
});

test("all matches past their window → check-live", () => {
  const schedule = [
    { kickoffTime: isoAt(-125), stage: "GROUP" },
    { kickoffTime: isoAt(-130), stage: "GROUP" },
  ];
  assert.strictEqual(computePollingGate(NOW, schedule), "check-live");
});

test("all matches in future → skip (no Firestore read needed)", () => {
  const schedule = [
    { kickoffTime: isoAt(60), stage: "GROUP" },
    { kickoffTime: isoAt(120), stage: "QF" },
  ];
  assert.strictEqual(computePollingGate(NOW, schedule), "skip");
});

test("match kicked off 9 hours ago → skip (past 8h upper bound, not check-live)", () => {
  // Prevents bundled fixture data from prior years from triggering Firestore
  // LIVE queries on every scheduler tick.
  const schedule = [{ kickoffTime: isoAt(-9 * 60), stage: "GROUP" }];
  assert.strictEqual(computePollingGate(NOW, schedule), "skip");
});

test("match kicked off 7 hours 59 minutes ago → check-live (within 8h bound)", () => {
  const schedule = [{ kickoffTime: isoAt(-(7 * 60 + 59)), stage: "QF" }];
  assert.strictEqual(computePollingGate(NOW, schedule), "check-live");
});

test("2022 fixture data (3+ years old) → skip, never check-live", () => {
  // Regression guard: worldcup2022.json kickoffs in Nov 2022.
  // With anchor 2026-06-15 these are ~3.5 years past kickoff.
  // Must return skip, not check-live, so the scheduler exits without
  // a Firestore read when no live tournament is underway.
  const schedule = [
    { kickoffTime: "2022-11-20T16:00:00Z", stage: "GROUP" },
    { kickoffTime: "2022-11-25T10:00:00Z", stage: "GROUP" },
    { kickoffTime: "2022-12-18T15:00:00Z", stage: "FINAL" },
  ];
  assert.strictEqual(computePollingGate(NOW, schedule), "skip");
});

// Verify stage variants all count as knockout
for (const stage of ["R32", "R16", "QF", "SF", "FINAL"]) {
  test(`stage=${stage} uses knockout window (221 min → check-live)`, () => {
    const schedule = [{ kickoffTime: isoAt(-221), stage }];
    assert.strictEqual(computePollingGate(NOW, schedule), "check-live");
  });
}

test("GROUP stage uses shorter window (121 min → check-live not proceed)", () => {
  const schedule = [{ kickoffTime: isoAt(-121), stage: "GROUP" }];
  assert.strictEqual(computePollingGate(NOW, schedule), "check-live");
});

// ── isScoringRelevantChange ─────────────────────────────────────────────────

console.log("\nisScoringRelevantChange");

const base = {
  homeScore: 1,
  awayScore: 0,
  status: "LIVE",
  stage: "GROUP",
  winner: null,
  homeRedCards: 0,
  homeYellowCards: 1,
  awayRedCards: 0,
  awayYellowCards: 0,
};

test("undefined existing → always relevant (new doc)", () => {
  assert.strictEqual(isScoringRelevantChange(undefined, base), true);
});

test("identical data → not relevant (no recompute)", () => {
  assert.strictEqual(isScoringRelevantChange({ ...base }, base), false);
});

test("homeScore change → relevant", () => {
  assert.strictEqual(
    isScoringRelevantChange({ ...base, homeScore: 0 }, base),
    true
  );
});

test("awayScore change → relevant", () => {
  assert.strictEqual(
    isScoringRelevantChange({ ...base }, { ...base, awayScore: 1 }),
    true
  );
});

test("status LIVE → FINISHED → relevant", () => {
  assert.strictEqual(
    isScoringRelevantChange({ ...base, status: "LIVE" }, { ...base, status: "FINISHED" }),
    true
  );
});

test("status SCHEDULED → LIVE → relevant", () => {
  assert.strictEqual(
    isScoringRelevantChange({ ...base, status: "SCHEDULED" }, { ...base, status: "LIVE" }),
    true
  );
});

test("winner set (penalty shootout resolved) → relevant", () => {
  assert.strictEqual(
    isScoringRelevantChange({ ...base }, { ...base, winner: "HOME" }),
    true
  );
});

test("winner null → null (no change) → not relevant", () => {
  assert.strictEqual(
    isScoringRelevantChange({ ...base, winner: null }, { ...base, winner: null }),
    false
  );
});

test("homeRedCards added → relevant", () => {
  assert.strictEqual(
    isScoringRelevantChange({ ...base }, { ...base, homeRedCards: 1 }),
    true
  );
});

test("awayRedCards added → relevant", () => {
  assert.strictEqual(
    isScoringRelevantChange({ ...base }, { ...base, awayRedCards: 1 }),
    true
  );
});

test("homeYellowCards change → relevant", () => {
  assert.strictEqual(
    isScoringRelevantChange({ ...base }, { ...base, homeYellowCards: 2 }),
    true
  );
});

test("awayYellowCards change → relevant", () => {
  assert.strictEqual(
    isScoringRelevantChange({ ...base }, { ...base, awayYellowCards: 3 }),
    true
  );
});

test("existing.homeRedCards missing (undefined) treated as 0 — no change → not relevant", () => {
  const existingNoCards = { ...base };
  delete existingNoCards.homeRedCards;
  assert.strictEqual(
    isScoringRelevantChange(existingNoCards, { ...base, homeRedCards: 0 }),
    false
  );
});

test("display-only field (minute) change → not relevant", () => {
  // minute is not in the scoring fields — adding it to existing doesn't affect the result
  const existingWithMinute = { ...base, minute: 45 };
  const incomingWithMinute = { ...base }; // minute absent from ScoringFields interface
  assert.strictEqual(isScoringRelevantChange(existingWithMinute, incomingWithMinute), false);
});

test("display-only field (homeScoreHT) change → not relevant", () => {
  const existingWithHT = { ...base, homeScoreHT: 0 };
  assert.strictEqual(isScoringRelevantChange(existingWithHT, base), false);
});

// ── bundled fixture guard ────────────────────────────────────────────────────
// Asserts that the bundled JSON fixture files contain only 2022 test dates and
// must NOT be used as the polling schedule in production.  The scheduler gate
// now reads from Firestore; if someone accidentally rewires it back to the
// bundled file, this test will catch the mismatch.

console.log("\nbundled fixture guard");

const worldcup2022 = require("../src/fixtures/worldcup2022.json");
const pretournament2022 = require("../src/fixtures/pretournament2022.json");

test("worldcup2022.json contains only 2022 kickoff dates (test fixture, not 2026)", () => {
  for (const m of worldcup2022) {
    const year = new Date(m.kickoffTime).getUTCFullYear();
    assert.strictEqual(year, 2022, `Expected year 2022, got ${year} for match ${m.matchId}`);
  }
});

test("pretournament2022.json contains only 2022 kickoff dates (test fixture, not 2026)", () => {
  for (const m of pretournament2022) {
    const year = new Date(m.kickoffTime).getUTCFullYear();
    assert.strictEqual(year, 2022, `Expected year 2022, got ${year} for match ${m.matchId}`);
  }
});

test("worldcup2022.json with computePollingGate → skip (must never poll in production with 2022 data)", () => {
  // The gate must return skip for 2022 data regardless of current time,
  // because all 2022 kickoffs are >8h in the past from any 2026 date.
  // If this returns check-live or proceed, the polling guard has regressed.
  assert.strictEqual(computePollingGate(Date.now(), worldcup2022), "skip");
});

test("pretournament2022.json with computePollingGate → skip", () => {
  assert.strictEqual(computePollingGate(Date.now(), pretournament2022), "skip");
});

// ── normalizeProviderStatus ─────────────────────────────────────────────────
// Verifies that every active provider status maps to "LIVE" so that the
// check-live Firestore query (status == "LIVE") correctly detects ongoing
// matches, and every terminal status maps to "FINISHED" so polling stops.

console.log("\nnormalizeProviderStatus");

// Active → LIVE
for (const active of ["IN_PLAY", "PAUSED", "LIVE", "EXTRA_TIME", "PENALTY_SHOOTOUT"]) {
  test(`${active} → "LIVE" (match still in progress)`, () => {
    assert.strictEqual(normalizeProviderStatus(active), "LIVE");
  });
  test(`${active.toLowerCase()} → "LIVE" (case-insensitive)`, () => {
    assert.strictEqual(normalizeProviderStatus(active.toLowerCase()), "LIVE");
  });
}

// Terminal → FINISHED
for (const terminal of ["FINISHED", "AFTER_EXTRA_TIME", "AFTER_PENALTIES", "AWARDED", "WALKOVER"]) {
  test(`${terminal} → "FINISHED" (match concluded)`, () => {
    assert.strictEqual(normalizeProviderStatus(terminal), "FINISHED");
  });
}

// Future → SCHEDULED
for (const future of ["SCHEDULED", "TIMED", "POSTPONED", "SUSPENDED"]) {
  test(`${future} → "SCHEDULED"`, () => {
    assert.strictEqual(normalizeProviderStatus(future), "SCHEDULED");
  });
}

// Unrecognised / dropped
test("CANCELLED → null (dropped, not ingested)", () => {
  assert.strictEqual(normalizeProviderStatus("CANCELLED"), null);
});
test("unknown string → null", () => {
  assert.strictEqual(normalizeProviderStatus("UNKNOWN_STATUS"), null);
});
test("null input → null", () => {
  assert.strictEqual(normalizeProviderStatus(null), null);
});
test("undefined input → null", () => {
  assert.strictEqual(normalizeProviderStatus(undefined), null);
});

// Regression guard for the two bugs that were fixed:
test("PENALTY_SHOOTOUT must NOT map to 'FINISHED' (regression guard)", () => {
  assert.notStrictEqual(normalizeProviderStatus("PENALTY_SHOOTOUT"), "FINISHED");
});
test("EXTRA_TIME must NOT return null (regression guard)", () => {
  assert.notStrictEqual(normalizeProviderStatus("EXTRA_TIME"), null);
});
test("AFTER_PENALTIES must NOT return null (regression guard)", () => {
  assert.notStrictEqual(normalizeProviderStatus("AFTER_PENALTIES"), null);
});

// ── summary ─────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log(`\n${passed}/${total} passed`);
if (failed > 0) {
  console.error(`${failed} test(s) FAILED`);
  process.exit(1);
}
