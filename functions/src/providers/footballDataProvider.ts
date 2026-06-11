import type { MatchStage, MatchStatus, ProviderGoal, ProviderMatch } from "./providerTypes";
import {
  FOOTBALL_DATA_BASE_DEFAULT,
  FOOTBALL_DATA_COMPETITION_DEFAULT,
  FOOTBALL_DATA_TOKEN,
  PROVIDER_MAX_RETRIES_DEFAULT,
  PROVIDER_TIMEOUT_MS_DEFAULT,
  asString,
  extractScore,
  fetchJsonWithRetry,
  filterAndLimitMatches,
  getTeamLookup,
  isRecord,
  mapProviderTeamId,
} from "./providerUtils";

function asNonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const n = Math.floor(value);
  return n < 0 ? 0 : n;
}

function asIsoOrNull(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  return Number.isNaN(Date.parse(raw)) ? null : raw;
}

/**
 * Normalize a football-data.org match status string to our canonical
 * MatchStatus.  Exported for unit testing.
 *
 * Active (→ "LIVE"):
 *   IN_PLAY, PAUSED (half-time), EXTRA_TIME, PENALTY_SHOOTOUT
 *
 * Terminal (→ "FINISHED"):
 *   FINISHED, AFTER_EXTRA_TIME, AFTER_PENALTIES, AWARDED, WALKOVER
 *
 * Future (→ "SCHEDULED"):
 *   SCHEDULED, TIMED, POSTPONED, SUSPENDED
 *
 * PENALTY_SHOOTOUT must be "LIVE" — the match is still being played.
 * Mapping it to "FINISHED" would cause the check-live gate to stop
 * polling before the shootout result (and winner field) is confirmed.
 */
export function normalizeProviderStatus(value: unknown): MatchStatus | null {
  const status = asString(value)?.toUpperCase();
  if (!status) return null;

  if (
    status === "IN_PLAY" ||
    status === "PAUSED" ||         // half-time break
    status === "LIVE" ||           // legacy / other-provider alias
    status === "EXTRA_TIME" ||     // match in extra time — still active
    status === "PENALTY_SHOOTOUT"  // match in shootout — still active
  ) {
    return "LIVE";
  }

  if (
    status === "FINISHED" ||
    status === "AFTER_EXTRA_TIME" || // concluded after ET (team won in ET)
    status === "AFTER_PENALTIES" ||  // concluded after shootout — result final
    status === "AWARDED" ||
    status === "WALKOVER"
  ) {
    return "FINISHED";
  }

  if (
    status === "SCHEDULED" ||
    status === "TIMED" ||
    status === "POSTPONED" ||
    status === "SUSPENDED"
  ) {
    return "SCHEDULED";
  }

  return null;
}

function toProviderStage(value: unknown): MatchStage {
  const stage = asString(value)?.toUpperCase();
  if (!stage) return "GROUP";

  if (stage === "LAST_32" || stage === "ROUND_OF_32") return "R32";
  if (stage === "LAST_16" || stage === "ROUND_OF_16") return "R16";
  if (stage === "QUARTER_FINALS") return "QF";
  if (stage === "SEMI_FINALS") return "SF";
  if (stage === "FINAL" || stage === "THIRD_PLACE") return "FINAL";
  if (stage === "GROUP_STAGE") return "GROUP";

  return "GROUP";
}

/**
 * Extract yellow and red card counts per team from the football-data.org
 * `bookings` array.  Requires the Deep Data plan.
 *
 * Card types returned by the v4 API (short forms):
 *   YELLOW      → yellow card
 *   RED         → straight red
 *   YELLOW_RED  → second yellow (sending-off; counts as a red. The first
 *                 yellow was recorded as a separate YELLOW entry earlier.)
 *
 * The long forms (YELLOW_CARD / RED_CARD / YELLOW_RED_CARD) are also accepted
 * defensively in case the provider ever reverts to verbose enum values — a
 * silent mismatch here zeroes out every card and breaks scoring (see the
 * 2026-06-11 MEX v RSA incident).
 */
function extractCards(
  raw: Record<string, unknown>,
  homeProviderId: unknown,
  awayProviderId: unknown
): {
  homeYellowCards: number;
  homeRedCards: number;
  awayYellowCards: number;
  awayRedCards: number;
} {
  const result = {
    homeYellowCards: 0,
    homeRedCards: 0,
    awayYellowCards: 0,
    awayRedCards: 0,
  };

  const bookings = Array.isArray(raw.bookings) ? raw.bookings : [];
  if (!bookings.length) return result;

  const homeId = String(homeProviderId ?? "");
  const awayId = String(awayProviderId ?? "");

  for (const booking of bookings) {
    if (!isRecord(booking)) continue;
    const teamRecord = isRecord(booking.team) ? booking.team : {};
    const teamId = String(teamRecord.id ?? "");
    const card = asString(booking.card)?.toUpperCase() ?? "";

    const isHome = homeId && teamId === homeId;
    const isAway = awayId && teamId === awayId;
    if (!isHome && !isAway) continue;

    // Any card containing RED is a sending-off (straight red OR second yellow).
    // Check RED first so YELLOW_RED is not miscounted as a plain yellow.
    if (card === "RED" || card === "RED_CARD" || card === "YELLOW_RED" || card === "YELLOW_RED_CARD") {
      if (isHome) result.homeRedCards += 1;
      else result.awayRedCards += 1;
    } else if (card === "YELLOW" || card === "YELLOW_CARD") {
      if (isHome) result.homeYellowCards += 1;
      else result.awayYellowCards += 1;
    }
  }

  return result;
}

/**
 * Extract goal scorer events from the football-data.org `goals` array.
 * Own goals are recorded under the benefiting team (the one that "scored").
 * Penalty shootout goals (type=PENALTY during status=PENALTY_SHOOTOUT) are
 * excluded — those are reflected in score.penalties, not goal events.
 */
function extractGoals(
  raw: Record<string, unknown>,
  homeProviderId: unknown,
  awayProviderId: unknown
): ProviderGoal[] {
  const goals = Array.isArray(raw.goals) ? raw.goals : [];
  if (!goals.length) return [];

  const homeId = String(homeProviderId ?? "");
  const awayId = String(awayProviderId ?? "");
  const result: ProviderGoal[] = [];

  for (const goal of goals) {
    if (!isRecord(goal)) continue;

    const teamRecord = isRecord(goal.team) ? goal.team : {};
    const teamId = String(teamRecord.id ?? "");
    const scorerRecord = isRecord(goal.scorer) ? goal.scorer : {};
    const playerName = asString(scorerRecord.name) ?? null;
    const minuteRaw = goal.minute;
    const minute =
      typeof minuteRaw === "number" && Number.isFinite(minuteRaw)
        ? Math.floor(minuteRaw)
        : null;
    const typeRaw = asString(goal.type)?.toUpperCase() ?? "REGULAR";

    // Skip penalty shootout goals — those belong to score.penalties
    if (typeRaw === "PENALTY_SHOOTOUT") continue;

    const isHome = homeId && teamId === homeId;
    const isAway = awayId && teamId === awayId;
    if (!isHome && !isAway) continue;

    let type: ProviderGoal["type"] = "REGULAR";
    if (typeRaw === "OWN_GOAL") type = "OWN_GOAL";
    else if (typeRaw === "PENALTY") type = "PENALTY";
    else if (typeRaw === "EXTRA_TIME") type = "EXTRA_TIME";

    result.push({
      minute,
      playerName,
      teamSide: isHome ? "home" : "away",
      type,
    });
  }

  return result;
}

/** Extract a nullable integer score from a half-time / penalty sub-object. */
function extractSubScore(
  score: unknown,
  side: "home" | "away"
): number | null {
  const rec = isRecord(score) ? score : {};
  const val = rec[side];
  if (typeof val !== "number" || !Number.isFinite(val)) return null;
  return Math.floor(val);
}

/** Map API winner string to our canonical form. */
function toWinner(value: unknown): "HOME" | "AWAY" | null {
  const w = asString(value)?.toUpperCase();
  if (w === "HOME_TEAM") return "HOME";
  if (w === "AWAY_TEAM") return "AWAY";
  return null;
}

export async function getFootballDataMatches(
  options: { maxMatches: number; cutoffIso: string | null }
): Promise<ProviderMatch[]> {
  const token =
    asString(FOOTBALL_DATA_TOKEN.value()) ??
    asString(process.env.FOOTBALL_DATA_TOKEN);
  if (!token) {
    console.warn("[ingest] FOOTBALL_DATA_TOKEN missing. Skipping provider ingest.");
    return [];
  }

  const base =
    asString(process.env.FOOTBALL_DATA_API_BASE) ?? FOOTBALL_DATA_BASE_DEFAULT;
  const competition =
    asString(process.env.FOOTBALL_DATA_COMPETITION) ?? FOOTBALL_DATA_COMPETITION_DEFAULT;
  const statuses =
    asString(process.env.FOOTBALL_DATA_STATUSES) ??
    "SCHEDULED,TIMED,IN_PLAY,PAUSED,FINISHED";
  const timeoutMs =
    asNonNegativeInteger(
      Number(process.env.PROVIDER_TIMEOUT_MS ?? PROVIDER_TIMEOUT_MS_DEFAULT)
    ) || PROVIDER_TIMEOUT_MS_DEFAULT;
  const maxRetries = asNonNegativeInteger(
    Number(process.env.PROVIDER_MAX_RETRIES ?? PROVIDER_MAX_RETRIES_DEFAULT)
  );

  const baseUrl = base.replace(/\/+$/, "");
  const season =
    asString(process.env.FOOTBALL_DATA_SEASON) ?? "2026";
  const url = `${baseUrl}/competitions/${encodeURIComponent(competition)}/matches?status=${encodeURIComponent(statuses)}&season=${encodeURIComponent(season)}`;

  const payload = await fetchJsonWithRetry(
    url,
    {
      method: "GET",
      headers: {
        "X-Auth-Token": token,
        Accept: "application/json",
      },
    },
    timeoutMs,
    maxRetries
  );

  const payloadRecord = isRecord(payload) ? payload : {};
  const rawMatches = Array.isArray(payloadRecord.matches) ? payloadRecord.matches : [];
  if (!rawMatches.length) return [];

  const teamLookup = await getTeamLookup();
  const mapped: ProviderMatch[] = [];
  // Collect unmapped teams across all matches; key by tla to deduplicate.
  const unmappedTeams = new Map<string, string>(); // tla → name

  rawMatches.forEach((raw: unknown) => {
    if (!isRecord(raw)) return;
    const rawId = raw.id;
    const matchId =
      typeof rawId === "number" || typeof rawId === "string"
        ? `fd-${String(rawId)}`
        : null;
    const homeTeamId = mapProviderTeamId(raw.homeTeam, teamLookup);
    const awayTeamId = mapProviderTeamId(raw.awayTeam, teamLookup);
    const status = normalizeProviderStatus(raw.status);
    const stage = toProviderStage(raw.stage);

    if (!matchId || !homeTeamId || !awayTeamId || !status) {
      const ht = isRecord(raw.homeTeam) ? raw.homeTeam : {};
      const at = isRecord(raw.awayTeam) ? raw.awayTeam : {};
      if (!homeTeamId) {
        const tla = String(ht.tla ?? "?");
        unmappedTeams.set(tla, `${tla}/${String(ht.shortName ?? ht.name ?? "")}`);
      }
      if (!awayTeamId) {
        const tla = String(at.tla ?? "?");
        unmappedTeams.set(tla, `${tla}/${String(at.shortName ?? at.name ?? "")}`);
      }
      return;
    }

    // Extract provider-level team IDs for card/goal attribution
    const homeProvId = isRecord(raw.homeTeam) ? raw.homeTeam.id : undefined;
    const awayProvId = isRecord(raw.awayTeam) ? raw.awayTeam.id : undefined;
    const cards = extractCards(raw, homeProvId, awayProvId);
    const goals = extractGoals(raw, homeProvId, awayProvId);

    const scoreObj = isRecord(raw.score) ? raw.score : {};
    const minuteRaw = raw.minute;

    mapped.push({
      matchId,
      homeTeamId,
      awayTeamId,
      homeScore: extractScore(raw.score, "home"),
      awayScore: extractScore(raw.score, "away"),
      status,
      stage,
      kickoffTime: asIsoOrNull(raw.utcDate),
      homeRedCards: cards.homeRedCards,
      homeYellowCards: cards.homeYellowCards,
      awayRedCards: cards.awayRedCards,
      awayYellowCards: cards.awayYellowCards,
      // Rich display data
      minute:
        typeof minuteRaw === "number" && Number.isFinite(minuteRaw)
          ? Math.floor(minuteRaw)
          : null,
      homeScoreHT: extractSubScore(scoreObj.halfTime, "home"),
      awayScoreHT: extractSubScore(scoreObj.halfTime, "away"),
      homeScorePens: extractSubScore(scoreObj.penalties, "home"),
      awayScorePens: extractSubScore(scoreObj.penalties, "away"),
      winner: toWinner(scoreObj.winner),
      goals: goals.length ? goals : undefined,
    });
  });

  const dropped = rawMatches.length - mapped.length;
  if (unmappedTeams.size > 0) {
    const teamList = [...unmappedTeams.values()].join(", ");
    console.warn(
      `[ingest] ${dropped}/${rawMatches.length} matches dropped — ` +
      `${unmappedTeams.size} unmapped team(s): ${teamList}`
    );
  }
  const limited = filterAndLimitMatches(mapped, options);
  console.log(
    `[ingest] provider loaded ${limited.length} mapped matches` +
      ` (${rawMatches.length} raw from API, ${dropped} dropped)` +
      ` (competition ${competition})` +
      (options.cutoffIso ? ` (cutoff ${options.cutoffIso})` : "") +
      (options.maxMatches > 0 ? ` (max ${options.maxMatches})` : "")
  );
  return limited;
}
