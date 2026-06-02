// Provisional 2026 World Cup knockout-stage placeholder fixtures.
//
// Purpose: give the polling gate real kickoff times for every knockout round
// so the scheduler opens the polling window and calls football-data.org
// once real teams are known — without requiring a code deploy at that time.
//
// Kickoff times are based on the FIFA 2026 published calendar
// (Final: 19 July 2026, MetLife Stadium NJ).  Verify exact slot times
// against the official FIFA match schedule before seeding to production.
//
// Team IDs use the TBD-* prefix which deliberately does not exist in the
// `teams` collection, so:
//   • validateMatchUpdate quarantines any provider update targeting these IDs
//   • recomputeScoresCore ignores these docs (isScoringEligible: false)

export type KnockoutPlaceholder = {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  homePlaceholder: string;
  awayPlaceholder: string;
  kickoffTime: string;
  stage: "R32" | "R16" | "QF" | "SF" | "FINAL";
};

// ── Round of 32 — M73–M88, June 29 – July 6 ─────────────────────────────────
// Labels from the published 2026 bracket.
// "Best 3rd Group X/Y/Z" slots list the possible source groups; the exact
// group is resolved after the group-stage standings are complete.

const R32: KnockoutPlaceholder[] = [
  { matchId: "wc2026-m73", homeTeamId: "TBD-M73-H", awayTeamId: "TBD-M73-A", homePlaceholder: "Runner-up Group A",         awayPlaceholder: "Runner-up Group B",        kickoffTime: "2026-06-29T20:00:00Z", stage: "R32" },
  { matchId: "wc2026-m74", homeTeamId: "TBD-M74-H", awayTeamId: "TBD-M74-A", homePlaceholder: "Winner Group E",            awayPlaceholder: "Best 3rd Group A/B/C/D/F", kickoffTime: "2026-06-29T23:00:00Z", stage: "R32" },
  { matchId: "wc2026-m75", homeTeamId: "TBD-M75-H", awayTeamId: "TBD-M75-A", homePlaceholder: "Winner Group F",            awayPlaceholder: "Runner-up Group C",         kickoffTime: "2026-06-30T20:00:00Z", stage: "R32" },
  { matchId: "wc2026-m76", homeTeamId: "TBD-M76-H", awayTeamId: "TBD-M76-A", homePlaceholder: "Winner Group C",            awayPlaceholder: "Runner-up Group F",         kickoffTime: "2026-06-30T23:00:00Z", stage: "R32" },
  { matchId: "wc2026-m77", homeTeamId: "TBD-M77-H", awayTeamId: "TBD-M77-A", homePlaceholder: "Winner Group I",            awayPlaceholder: "Best 3rd Group C/D/F/G/H", kickoffTime: "2026-07-01T20:00:00Z", stage: "R32" },
  { matchId: "wc2026-m78", homeTeamId: "TBD-M78-H", awayTeamId: "TBD-M78-A", homePlaceholder: "Runner-up Group E",         awayPlaceholder: "Runner-up Group I",         kickoffTime: "2026-07-01T23:00:00Z", stage: "R32" },
  { matchId: "wc2026-m79", homeTeamId: "TBD-M79-H", awayTeamId: "TBD-M79-A", homePlaceholder: "Winner Group A",            awayPlaceholder: "Best 3rd Group C/E/F/H/I", kickoffTime: "2026-07-02T20:00:00Z", stage: "R32" },
  { matchId: "wc2026-m80", homeTeamId: "TBD-M80-H", awayTeamId: "TBD-M80-A", homePlaceholder: "Winner Group L",            awayPlaceholder: "Best 3rd Group E/H/I/J/K", kickoffTime: "2026-07-02T23:00:00Z", stage: "R32" },
  { matchId: "wc2026-m81", homeTeamId: "TBD-M81-H", awayTeamId: "TBD-M81-A", homePlaceholder: "Winner Group D",            awayPlaceholder: "Best 3rd Group B/E/F/I/J", kickoffTime: "2026-07-03T20:00:00Z", stage: "R32" },
  { matchId: "wc2026-m82", homeTeamId: "TBD-M82-H", awayTeamId: "TBD-M82-A", homePlaceholder: "Winner Group G",            awayPlaceholder: "Best 3rd Group A/E/H/I/J", kickoffTime: "2026-07-03T23:00:00Z", stage: "R32" },
  { matchId: "wc2026-m83", homeTeamId: "TBD-M83-H", awayTeamId: "TBD-M83-A", homePlaceholder: "Runner-up Group K",         awayPlaceholder: "Runner-up Group L",         kickoffTime: "2026-07-04T20:00:00Z", stage: "R32" },
  { matchId: "wc2026-m84", homeTeamId: "TBD-M84-H", awayTeamId: "TBD-M84-A", homePlaceholder: "Winner Group H",            awayPlaceholder: "Runner-up Group J",         kickoffTime: "2026-07-04T23:00:00Z", stage: "R32" },
  { matchId: "wc2026-m85", homeTeamId: "TBD-M85-H", awayTeamId: "TBD-M85-A", homePlaceholder: "Winner Group B",            awayPlaceholder: "Best 3rd Group E/F/G/I/J", kickoffTime: "2026-07-05T20:00:00Z", stage: "R32" },
  { matchId: "wc2026-m86", homeTeamId: "TBD-M86-H", awayTeamId: "TBD-M86-A", homePlaceholder: "Winner Group J",            awayPlaceholder: "Runner-up Group H",         kickoffTime: "2026-07-05T23:00:00Z", stage: "R32" },
  { matchId: "wc2026-m87", homeTeamId: "TBD-M87-H", awayTeamId: "TBD-M87-A", homePlaceholder: "Winner Group K",            awayPlaceholder: "Best 3rd Group D/E/I/J/L", kickoffTime: "2026-07-06T20:00:00Z", stage: "R32" },
  { matchId: "wc2026-m88", homeTeamId: "TBD-M88-H", awayTeamId: "TBD-M88-A", homePlaceholder: "Runner-up Group D",         awayPlaceholder: "Runner-up Group G",         kickoffTime: "2026-07-06T23:00:00Z", stage: "R32" },
];

// ── Round of 16 — M89–M96, July 8 – July 11 ─────────────────────────────────

const R16: KnockoutPlaceholder[] = [
  { matchId: "wc2026-m89", homeTeamId: "TBD-M89-H", awayTeamId: "TBD-M89-A", homePlaceholder: "Winner M74", awayPlaceholder: "Winner M77", kickoffTime: "2026-07-08T20:00:00Z", stage: "R16" },
  { matchId: "wc2026-m90", homeTeamId: "TBD-M90-H", awayTeamId: "TBD-M90-A", homePlaceholder: "Winner M73", awayPlaceholder: "Winner M75", kickoffTime: "2026-07-08T23:00:00Z", stage: "R16" },
  { matchId: "wc2026-m91", homeTeamId: "TBD-M91-H", awayTeamId: "TBD-M91-A", homePlaceholder: "Winner M76", awayPlaceholder: "Winner M78", kickoffTime: "2026-07-09T20:00:00Z", stage: "R16" },
  { matchId: "wc2026-m92", homeTeamId: "TBD-M92-H", awayTeamId: "TBD-M92-A", homePlaceholder: "Winner M79", awayPlaceholder: "Winner M80", kickoffTime: "2026-07-09T23:00:00Z", stage: "R16" },
  { matchId: "wc2026-m93", homeTeamId: "TBD-M93-H", awayTeamId: "TBD-M93-A", homePlaceholder: "Winner M83", awayPlaceholder: "Winner M84", kickoffTime: "2026-07-10T20:00:00Z", stage: "R16" },
  { matchId: "wc2026-m94", homeTeamId: "TBD-M94-H", awayTeamId: "TBD-M94-A", homePlaceholder: "Winner M81", awayPlaceholder: "Winner M82", kickoffTime: "2026-07-10T23:00:00Z", stage: "R16" },
  { matchId: "wc2026-m95", homeTeamId: "TBD-M95-H", awayTeamId: "TBD-M95-A", homePlaceholder: "Winner M86", awayPlaceholder: "Winner M88", kickoffTime: "2026-07-11T20:00:00Z", stage: "R16" },
  { matchId: "wc2026-m96", homeTeamId: "TBD-M96-H", awayTeamId: "TBD-M96-A", homePlaceholder: "Winner M85", awayPlaceholder: "Winner M87", kickoffTime: "2026-07-11T23:00:00Z", stage: "R16" },
];

// ── Quarter-finals — 4 matches, July 13 – 14 ────────────────────────────────

const QF: KnockoutPlaceholder[] = [
  { matchId: "wc2026-qf-01", homeTeamId: "TBD-QF-H01", awayTeamId: "TBD-QF-A01", homePlaceholder: "Winner M89", awayPlaceholder: "Winner M90", kickoffTime: "2026-07-13T20:00:00Z", stage: "QF" },
  { matchId: "wc2026-qf-02", homeTeamId: "TBD-QF-H02", awayTeamId: "TBD-QF-A02", homePlaceholder: "Winner M91", awayPlaceholder: "Winner M92", kickoffTime: "2026-07-13T23:00:00Z", stage: "QF" },
  { matchId: "wc2026-qf-03", homeTeamId: "TBD-QF-H03", awayTeamId: "TBD-QF-A03", homePlaceholder: "Winner M93", awayPlaceholder: "Winner M94", kickoffTime: "2026-07-14T20:00:00Z", stage: "QF" },
  { matchId: "wc2026-qf-04", homeTeamId: "TBD-QF-H04", awayTeamId: "TBD-QF-A04", homePlaceholder: "Winner M95", awayPlaceholder: "Winner M96", kickoffTime: "2026-07-14T23:00:00Z", stage: "QF" },
];

// ── Semi-finals — 2 matches, July 16 – 17 ───────────────────────────────────

const SF: KnockoutPlaceholder[] = [
  { matchId: "wc2026-sf-01", homeTeamId: "TBD-SF-H01", awayTeamId: "TBD-SF-A01", homePlaceholder: "Winner QF Match 1", awayPlaceholder: "Winner QF Match 2", kickoffTime: "2026-07-16T22:00:00Z", stage: "SF" },
  { matchId: "wc2026-sf-02", homeTeamId: "TBD-SF-H02", awayTeamId: "TBD-SF-A02", homePlaceholder: "Winner QF Match 3", awayPlaceholder: "Winner QF Match 4", kickoffTime: "2026-07-17T22:00:00Z", stage: "SF" },
];

// ── Final stage — 3rd place play-off + Final ─────────────────────────────────
// Third place uses stage "FINAL" — same as in the football-data.org normaliser.

const FINAL_STAGE: KnockoutPlaceholder[] = [
  { matchId: "wc2026-3po-01",   homeTeamId: "TBD-3PO-H01", awayTeamId: "TBD-3PO-A01", homePlaceholder: "Semi-final runner-up", awayPlaceholder: "Semi-final runner-up", kickoffTime: "2026-07-18T19:00:00Z", stage: "FINAL" },
  { matchId: "wc2026-final-01", homeTeamId: "TBD-FIN-H01", awayTeamId: "TBD-FIN-A01", homePlaceholder: "Semi-final winner",    awayPlaceholder: "Semi-final winner",    kickoffTime: "2026-07-19T22:00:00Z", stage: "FINAL" },
];

export const KNOCKOUT_PLACEHOLDERS_2026: KnockoutPlaceholder[] =
  [...R32, ...R16, ...QF, ...SF, ...FINAL_STAGE];
