// Pure polling-window helpers — no Firebase imports.
// Imported by ingest.ts and unit-tested directly via lib/pollingWindow.js.

export const POLLING_PRE_KICKOFF_MS = 10 * 60 * 1000;
export const POLLING_GROUP_WINDOW_MS = 120 * 60 * 1000;    // 2 h after kickoff
export const POLLING_KNOCKOUT_WINDOW_MS = 220 * 60 * 1000; // 3 h 40 m after kickoff

// Upper bound for the check-live fallback.  Any match whose kickoff was more
// than 8 hours ago cannot plausibly be in ET or penalties — skip the Firestore
// query rather than triggering it on every tick for dates years in the past
// (e.g. when the bundled fixture file predates the live tournament).
export const POLLING_MAX_ELAPSED_MS = 8 * 60 * 60 * 1000; // 8 h

export type ScheduleEntry = { kickoffTime?: unknown; stage?: unknown };

/**
 * Three-state gate for the scheduled ingest function.
 *
 * - 'skip'       All fixture matches are in the future (>10 min until kickoff).
 *                No Firestore read or API call needed.
 *
 * - 'proceed'    At least one match is inside its active time window
 *                [kickoff − 10 min, kickoff + maxDuration].  Ingest immediately.
 *
 * - 'check-live' One or more matches have started but are past the fixed time
 *                window (i.e. the match may be in long ET / penalty shootout).
 *                Caller must do a Firestore LIVE-status query before proceeding.
 *                This is the only path that costs an extra Firestore read, and
 *                only occurs on ticks that happen after a match has kicked off.
 */
export type PollingGate = "skip" | "proceed" | "check-live";

export function computePollingGate(
  nowMs: number,
  schedule: ScheduleEntry[]
): PollingGate {
  let anyMatchStarted = false;

  for (const match of schedule) {
    const kickoff =
      typeof match.kickoffTime === "string"
        ? Date.parse(match.kickoffTime)
        : NaN;
    if (Number.isNaN(kickoff)) continue;

    const isKnockout = match.stage !== "GROUP";
    const windowMs = isKnockout
      ? POLLING_KNOCKOUT_WINDOW_MS
      : POLLING_GROUP_WINDOW_MS;
    const windowStart = kickoff - POLLING_PRE_KICKOFF_MS;
    const windowEnd = kickoff + windowMs;

    if (nowMs >= windowStart && nowMs <= windowEnd) return "proceed";

    // Only flag a match as "recently started" when it could still plausibly
    // be running (ET / pen shootout past the fixed window).  Matches whose
    // kickoff was more than POLLING_MAX_ELAPSED_MS ago are definitely over —
    // don't trigger a Firestore round-trip for fixture data from prior years.
    if (nowMs > windowStart && nowMs < kickoff + POLLING_MAX_ELAPSED_MS) {
      anyMatchStarted = true;
    }
  }

  return anyMatchStarted ? "check-live" : "skip";
}

// Minimal interface that ValidatedMatchUpdate satisfies — kept narrow so
// pollingWindow.ts stays Firebase-free.
export interface ScoringFields {
  homeScore: number | null | undefined;
  awayScore: number | null | undefined;
  status: string | null | undefined;
  stage: string | null | undefined;
  winner?: string | null;
  homeRedCards: number | null | undefined;
  homeYellowCards: number | null | undefined;
  awayRedCards: number | null | undefined;
  awayYellowCards: number | null | undefined;
}

/**
 * Returns true when the incoming data contains a change that affects scoring
 * (goals, match result, winner, card counts).  Display-only fields (minute,
 * half-time score, pen breakdown, kickoffTime) do NOT trigger a recompute.
 */
export function isScoringRelevantChange(
  existing: Record<string, unknown> | undefined,
  incoming: ScoringFields
): boolean {
  if (!existing) return true;
  return (
    existing["homeScore"] !== incoming.homeScore ||
    existing["awayScore"] !== incoming.awayScore ||
    existing["status"] !== incoming.status ||
    existing["stage"] !== incoming.stage ||
    (existing["winner"] ?? null) !== (incoming.winner ?? null) ||
    (existing["homeRedCards"] ?? 0) !== (incoming.homeRedCards ?? 0) ||
    (existing["homeYellowCards"] ?? 0) !== (incoming.homeYellowCards ?? 0) ||
    (existing["awayRedCards"] ?? 0) !== (incoming.awayRedCards ?? 0) ||
    (existing["awayYellowCards"] ?? 0) !== (incoming.awayYellowCards ?? 0)
  );
}
