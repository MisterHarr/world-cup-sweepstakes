import type { MatchStage, MatchStatus, ProviderMatch } from "./providerTypes";
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

function toProviderStatus(value: unknown): MatchStatus | null {
  const status = asString(value)?.toUpperCase();
  if (!status) return null;

  if (status === "IN_PLAY" || status === "PAUSED" || status === "LIVE") return "LIVE";
  if (
    status === "FINISHED" ||
    status === "AWARDED" ||
    status === "AFTER_EXTRA_TIME" ||
    status === "PENALTY_SHOOTOUT"
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
  const url = `${baseUrl}/competitions/${encodeURIComponent(competition)}/matches?status=${encodeURIComponent(statuses)}`;

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

  rawMatches.forEach((raw: unknown) => {
    if (!isRecord(raw)) return;
    const rawId = raw.id;
    const matchId =
      typeof rawId === "number" || typeof rawId === "string"
        ? `fd-${String(rawId)}`
        : null;
    const homeTeamId = mapProviderTeamId(raw.homeTeam, teamLookup);
    const awayTeamId = mapProviderTeamId(raw.awayTeam, teamLookup);
    const status = toProviderStatus(raw.status);
    const stage = toProviderStage(raw.stage);

    if (!matchId || !homeTeamId || !awayTeamId || !status) return;

    mapped.push({
      matchId,
      homeTeamId,
      awayTeamId,
      homeScore: extractScore(raw.score, "home"),
      awayScore: extractScore(raw.score, "away"),
      status,
      stage,
      kickoffTime: asIsoOrNull(raw.utcDate),
      homeRedCards: 0,
      homeYellowCards: 0,
      awayRedCards: 0,
      awayYellowCards: 0,
    });
  });

  const limited = filterAndLimitMatches(mapped, options);
  console.log(
    `[ingest] provider loaded ${limited.length} mapped matches` +
      ` (competition ${competition})` +
      (options.cutoffIso ? ` (cutoff ${options.cutoffIso})` : "") +
      (options.maxMatches > 0 ? ` (max ${options.maxMatches})` : "")
  );
  return limited;
}
